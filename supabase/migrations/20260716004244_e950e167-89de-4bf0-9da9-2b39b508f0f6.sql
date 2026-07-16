
DO $$
DECLARE
  v_run uuid := 'a1b2c3d4-0000-0000-0000-000000000002';
  v_del1 uuid := 'f82f9548-1a39-4e64-abed-ad3eef12d41f';
  v_surv1 uuid := '5f22d1bd-cbee-47df-bf3c-88f8bae979b6';
  v_del2 uuid := 'e3789a06-78dc-44c4-a5ef-97bcbbab0e50';
  v_surv2 uuid := '99b5e7df-891a-4575-838f-17f000527f46';
  v_ledger int;
  v_snap_stores int; v_snap_notes int; v_snap_inv int;
  v_orphan_notes int;
  v_hard_deleted int; v_soft_deleted int;
  v_survivors_live int;
  v_remaining_dups int;
BEGIN
  SELECT count(*) INTO v_ledger FROM public.tube_sale_ledger
   WHERE store_id IN (v_del1, v_del2);
  IF v_ledger > 0 THEN
    RAISE EXCEPTION 'tube_sale_ledger rows exist (%).', v_ledger;
  END IF;

  CREATE TABLE IF NOT EXISTS public._final2_snap_stores_a1b2c3d4 AS SELECT * FROM public.stores WHERE false;
  CREATE TABLE IF NOT EXISTS public._final2_snap_notes_a1b2c3d4 AS SELECT * FROM public.store_notes WHERE false;
  CREATE TABLE IF NOT EXISTS public._final2_snap_invoices_a1b2c3d4 AS SELECT * FROM public.invoices WHERE false;

  INSERT INTO public._final2_snap_stores_a1b2c3d4 SELECT * FROM public.stores WHERE id IN (v_del1, v_del2);
  GET DIAGNOSTICS v_snap_stores = ROW_COUNT;
  INSERT INTO public._final2_snap_notes_a1b2c3d4 SELECT * FROM public.store_notes WHERE store_id IN (v_del1, v_del2);
  GET DIAGNOSTICS v_snap_notes = ROW_COUNT;
  INSERT INTO public._final2_snap_invoices_a1b2c3d4 SELECT * FROM public.invoices
    WHERE entity_type='store' AND entity_id IN (v_del1, v_del2);
  GET DIAGNOSTICS v_snap_inv = ROW_COUNT;

  IF v_snap_stores <> 2 THEN RAISE EXCEPTION 'snap wrong: %', v_snap_stores; END IF;

  -- alt_phone merge
  UPDATE public.stores SET alt_phone='347-951-2312', updated_at=now()
   WHERE id=v_surv2 AND (alt_phone IS NULL OR alt_phone='');

  -- re-point notes
  UPDATE public.store_notes SET store_id=v_surv1 WHERE store_id=v_del1;
  UPDATE public.store_notes SET store_id=v_surv2 WHERE store_id=v_del2;

  SELECT count(*) INTO v_orphan_notes FROM public.store_notes WHERE store_id IN (v_del1, v_del2);
  IF v_orphan_notes > 0 THEN RAISE EXCEPTION 'orphan notes %', v_orphan_notes; END IF;

  -- Avenue U: no invoices → hard delete
  DELETE FROM public.stores WHERE id = v_del1;
  GET DIAGNOSTICS v_hard_deleted = ROW_COUNT;

  -- ZOOTED del: holds finalized invoice; cannot re-point → soft-delete + tag
  UPDATE public.stores
     SET deleted_at = now(),
         notes_old = coalesce(notes_old,'') || E'\n[merged into '||v_surv2||' run='||v_run||' — finalized invoice retained]'
   WHERE id = v_del2;
  GET DIAGNOSTICS v_soft_deleted = ROW_COUNT;

  SELECT count(*) INTO v_survivors_live FROM public.stores
   WHERE id IN (v_surv1, v_surv2) AND deleted_at IS NULL;

  SELECT count(*) INTO v_remaining_dups FROM (
    SELECT lower(trim(name)) n, lower(trim(coalesce(address_street,''))) a, coalesce(address_zip,'') z
      FROM public.stores WHERE deleted_at IS NULL
     GROUP BY 1,2,3 HAVING count(*) > 1
  ) x;

  RAISE NOTICE 'RUN=% snap_stores=% snap_notes=% snap_inv=% hard_deleted=% soft_deleted=% survivors_live=% remaining_name_addr_dups=%',
    v_run, v_snap_stores, v_snap_notes, v_snap_inv, v_hard_deleted, v_soft_deleted, v_survivors_live, v_remaining_dups;
END $$;

ALTER TABLE public._final2_snap_stores_a1b2c3d4 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._final2_snap_notes_a1b2c3d4 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._final2_snap_invoices_a1b2c3d4 ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public._final2_snap_stores_a1b2c3d4 TO service_role;
GRANT ALL ON public._final2_snap_notes_a1b2c3d4 TO service_role;
GRANT ALL ON public._final2_snap_invoices_a1b2c3d4 TO service_role;
CREATE POLICY "svc" ON public._final2_snap_stores_a1b2c3d4 FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "svc" ON public._final2_snap_notes_a1b2c3d4 FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "svc" ON public._final2_snap_invoices_a1b2c3d4 FOR ALL TO service_role USING (true) WITH CHECK (true);
