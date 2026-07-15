
-- Batches 13–22 live enrichment runner
CREATE TABLE IF NOT EXISTS public._batch_run_results (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL,
  batch_num int NOT NULL,
  offset_start int NOT NULL,
  store_ids text NOT NULL,
  plan_owner int, plan_contact int, plan_phone int,
  plan_notes int, plan_invoices int, plan_conflicts int,
  wr_owner int, wr_contact int, wr_phone int,
  wr_notes int, wr_invoices int,
  ran_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public._batch_run_results TO authenticated;
GRANT ALL ON public._batch_run_results TO service_role;

DO $mig$
DECLARE
  v_run uuid := '76316034-3a2e-4610-8a78-b906243766c3';
  v_batch int;
  v_off int;
  v_ids uuid[];
  v_ids_txt text;
  p_owner int; p_contact int; p_phone int;
  p_notes int; p_invoices int; p_conflicts int;
  w_owner int; w_contact int; w_phone int;
  w_notes int; w_invoices int;
BEGIN
  FOR v_batch IN 13..22 LOOP
    v_off := (v_batch - 1) * 25;

    SELECT array_agg(id ORDER BY id), string_agg(id::text, ',' ORDER BY id)
      INTO v_ids, v_ids_txt
    FROM (
      SELECT id FROM public._snap_store_master
      WHERE run_id = v_run
      ORDER BY id OFFSET v_off LIMIT 25
    ) s;

    IF array_length(v_ids,1) <> 25 THEN
      RAISE EXCEPTION 'Batch % expected 25 stores, got %', v_batch, array_length(v_ids,1);
    END IF;

    -- Planned counts
    SELECT count(*) FILTER (WHERE field='owner_name'),
           count(*) FILTER (WHERE field='contact_name'),
           count(*) FILTER (WHERE field='phone')
      INTO p_owner, p_contact, p_phone
    FROM public._phase_plan_scalars WHERE store_id = ANY(v_ids);

    SELECT count(*) INTO p_notes
      FROM public._phase_plan_notes WHERE store_id = ANY(v_ids);

    SELECT count(*) INTO p_invoices
      FROM public._phase_plan_invoices_final WHERE store_id = ANY(v_ids);

    SELECT count(*) INTO p_conflicts
      FROM public._phase_plan_conflicts WHERE store_id = ANY(v_ids);

    -- Scalars: owner_name (blanks only)
    WITH upd AS (
      UPDATE public.store_master sm
      SET owner_name = ps.v7_value
      FROM public._phase_plan_scalars ps
      WHERE ps.store_id = sm.id
        AND ps.field = 'owner_name'
        AND sm.id = ANY(v_ids)
        AND (sm.owner_name IS NULL OR sm.owner_name = '')
      RETURNING 1
    ) SELECT count(*) INTO w_owner FROM upd;

    WITH upd AS (
      UPDATE public.store_master sm
      SET contact_name = ps.v7_value
      FROM public._phase_plan_scalars ps
      WHERE ps.store_id = sm.id
        AND ps.field = 'contact_name'
        AND sm.id = ANY(v_ids)
        AND (sm.contact_name IS NULL OR sm.contact_name = '')
      RETURNING 1
    ) SELECT count(*) INTO w_contact FROM upd;

    WITH upd AS (
      UPDATE public.store_master sm
      SET phone = ps.v7_value
      FROM public._phase_plan_scalars ps
      WHERE ps.store_id = sm.id
        AND ps.field = 'phone'
        AND sm.id = ANY(v_ids)
        AND (sm.phone IS NULL OR sm.phone = '')
      RETURNING 1
    ) SELECT count(*) INTO w_phone FROM upd;

    -- Notes
    WITH ins AS (
      INSERT INTO public.store_notes
        (store_id, note_text, note_date, brand_scope, source, enrichment_run_id)
      SELECT store_id, note, now(), 'gasmask', 'v7_enrichment', v_run
      FROM public._phase_plan_notes
      WHERE store_id = ANY(v_ids)
      RETURNING 1
    ) SELECT count(*) INTO w_notes FROM ins;

    -- Invoices
    WITH ins AS (
      INSERT INTO public.invoices
        (invoice_number, store_id, subtotal, tax, total, total_amount,
         status, payment_status, is_historical, business_date, entry_mode,
         notes, enrichment_run_id, customer_type, entity_type, entity_id)
      SELECT 'AI-76316034-' || row_no,
             store_id, amount, 0, amount, amount,
             'draft_ai', 'unpaid', TRUE, CURRENT_DATE, 'ai_enrichment',
             COALESCE(invoice_date || ' - ','') || COALESCE(description,''),
             v_run, 'store', 'store', store_id
      FROM public._phase_plan_invoices_final
      WHERE store_id = ANY(v_ids)
      RETURNING 1
    ) SELECT count(*) INTO w_invoices FROM ins;

    -- Assertions
    IF w_notes <> p_notes THEN
      RAISE EXCEPTION 'Batch % notes mismatch: planned % written %', v_batch, p_notes, w_notes;
    END IF;
    IF w_invoices <> p_invoices THEN
      RAISE EXCEPTION 'Batch % invoices mismatch: planned % written %', v_batch, p_invoices, w_invoices;
    END IF;
    IF w_owner <> p_owner THEN
      RAISE EXCEPTION 'Batch % owner_name mismatch: planned % written %', v_batch, p_owner, w_owner;
    END IF;
    IF w_contact <> p_contact THEN
      RAISE EXCEPTION 'Batch % contact_name mismatch: planned % written %', v_batch, p_contact, w_contact;
    END IF;
    IF w_phone <> p_phone THEN
      RAISE EXCEPTION 'Batch % phone mismatch: planned % written %', v_batch, p_phone, w_phone;
    END IF;

    INSERT INTO public._batch_run_results
      (run_id, batch_num, offset_start, store_ids,
       plan_owner, plan_contact, plan_phone, plan_notes, plan_invoices, plan_conflicts,
       wr_owner, wr_contact, wr_phone, wr_notes, wr_invoices)
    VALUES
      (v_run, v_batch, v_off, v_ids_txt,
       p_owner, p_contact, p_phone, p_notes, p_invoices, p_conflicts,
       w_owner, w_contact, w_phone, w_notes, w_invoices);
  END LOOP;
END $mig$;
