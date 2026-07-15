
DO $$
DECLARE
  v_run_id uuid := 'bb220002-0000-4000-8000-000000000002';
  v_batch int;
  v_offset int;
  v_batch_num int;
  v_ids uuid[];
  v_ids_txt text;
  p_owner int; p_contact int; p_phone int; p_notes int; p_inv int; p_conf int;
  w_owner int; w_contact int; w_phone int; w_notes int; w_inv int;
BEGIN
  FOR v_batch IN 1..11 LOOP
    v_offset := 250 + (v_batch - 1) * 25;
    v_batch_num := 10 + v_batch;

    SELECT ARRAY_AGG(prod_store_id ORDER BY prod_store_id::text)
      INTO v_ids
    FROM (
      SELECT prod_store_id
      FROM _pass2_match_manifest
      ORDER BY prod_store_id::text
      OFFSET v_offset LIMIT 25
    ) t;

    IF v_ids IS NULL OR array_length(v_ids,1) IS NULL THEN
      CONTINUE;
    END IF;

    v_ids_txt := array_to_string(v_ids, ',');

    SELECT
      COUNT(*) FILTER (WHERE field='owner_name'),
      COUNT(*) FILTER (WHERE field='contact_name'),
      COUNT(*) FILTER (WHERE field='phone')
      INTO p_owner, p_contact, p_phone
    FROM _pass2_plan_scalars WHERE store_id = ANY(v_ids);

    SELECT COUNT(*) INTO p_notes FROM _pass2_plan_notes WHERE store_id = ANY(v_ids);
    SELECT COUNT(*) INTO p_inv FROM _pass2_plan_invoices_final WHERE store_id = ANY(v_ids);
    SELECT COUNT(*) INTO p_conf FROM _pass2_plan_conflicts WHERE store_id = ANY(v_ids);

    WITH upd AS (
      UPDATE store_master s
         SET owner_name = p.v7_value
        FROM _pass2_plan_scalars p
       WHERE p.store_id = s.id
         AND p.store_id = ANY(v_ids)
         AND p.field = 'owner_name'
         AND (s.owner_name IS NULL OR btrim(s.owner_name) = '')
         AND p.v7_value IS NOT NULL AND btrim(p.v7_value) <> ''
      RETURNING 1
    ) SELECT COUNT(*) INTO w_owner FROM upd;

    WITH upd AS (
      UPDATE store_master s
         SET contact_name = p.v7_value
        FROM _pass2_plan_scalars p
       WHERE p.store_id = s.id
         AND p.store_id = ANY(v_ids)
         AND p.field = 'contact_name'
         AND (s.contact_name IS NULL OR btrim(s.contact_name) = '')
         AND p.v7_value IS NOT NULL AND btrim(p.v7_value) <> ''
      RETURNING 1
    ) SELECT COUNT(*) INTO w_contact FROM upd;

    WITH upd AS (
      UPDATE store_master s
         SET phone = p.v7_value
        FROM _pass2_plan_scalars p
       WHERE p.store_id = s.id
         AND p.store_id = ANY(v_ids)
         AND p.field = 'phone'
         AND (s.phone IS NULL OR btrim(s.phone) = '')
         AND p.v7_value IS NOT NULL AND btrim(p.v7_value) <> ''
      RETURNING 1
    ) SELECT COUNT(*) INTO w_phone FROM upd;

    WITH ins AS (
      INSERT INTO store_notes (store_id, note_text, note_date, brand_scope, source, enrichment_run_id)
      SELECT n.store_id, n.note, now(), 'gasmask', 'v7_enrichment_pass2', v_run_id
        FROM _pass2_plan_notes n
       WHERE n.store_id = ANY(v_ids)
      RETURNING 1
    ) SELECT COUNT(*) INTO w_notes FROM ins;

    WITH ins AS (
      INSERT INTO invoices (
        invoice_number, store_id, entity_type, entity_id,
        total_amount, subtotal, tax, total, amount_paid,
        due_date, payment_status, customer_type,
        notes, status, is_historical, pricing_mode, entry_mode,
        business_date, enrichment_run_id
      )
      SELECT
        'AI-PASS2-' || i.row_no,
        i.store_id, 'store', i.store_id,
        COALESCE(i.amount,0), COALESCE(i.amount,0), 0, COALESCE(i.amount,0), 0,
        CURRENT_DATE + INTERVAL '30 days', 'unpaid', 'store',
        COALESCE(i.invoice_date,'') || ' - ' || COALESCE(i.description,''),
        'draft_ai', true, 'retail', 'ai_enrichment',
        CURRENT_DATE, v_run_id
      FROM _pass2_plan_invoices_final i
      WHERE i.store_id = ANY(v_ids)
      RETURNING 1
    ) SELECT COUNT(*) INTO w_inv FROM ins;

    INSERT INTO _pass2_batch_run_results (
      run_id, batch_num, offset_start, store_ids,
      plan_owner, plan_contact, plan_phone, plan_notes, plan_invoices, plan_conflicts,
      wr_owner, wr_contact, wr_phone, wr_notes, wr_invoices
    ) VALUES (
      v_run_id, v_batch_num, v_offset, v_ids_txt,
      p_owner, p_contact, p_phone, p_notes, p_inv, p_conf,
      w_owner, w_contact, w_phone, w_notes, w_inv
    );
  END LOOP;
END $$;
