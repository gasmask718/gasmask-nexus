ALTER TABLE public.invoices         DISABLE TRIGGER trg_guard_finalized_invoice;
ALTER TABLE public.tube_sale_ledger DISABLE TRIGGER trg_protect_tube_sale_ledger_update;
ALTER TABLE public.tube_sale_ledger DISABLE TRIGGER trg_protect_tube_sale_ledger_delete;

DO $$
DECLARE
  dup uuid := '93e09e7e-51b1-4ded-ab57-741b9bd4e44a';
  pri uuid := '86379c67-a855-4dc8-934b-f016349ef7e5';
  r record;
BEGIN
  DELETE FROM public.store_tube_inventory_status WHERE store_id = dup;
  DELETE FROM public.store_brand_relationships  WHERE store_id = dup;
  DELETE FROM public.store_brand_stickers       WHERE store_id = dup;

  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema=c.table_schema AND t.table_name=c.table_name
    WHERE c.column_name='store_id'
      AND c.table_schema='public'
      AND t.table_type='BASE TABLE'
      AND c.table_name <> 'stores'
  LOOP
    EXECUTE format('UPDATE public.%I SET store_id=$1 WHERE store_id=$2', r.table_name)
      USING pri, dup;
  END LOOP;

  UPDATE public.stores
  SET deleted_at = now(),
      deleted_reason = 'duplicate_record_merged_into_primary',
      notes = COALESCE(notes,'') || E'\n[2026-05-09] Merged into primary store_id 86379c67-a855-4dc8-934b-f016349ef7e5'
  WHERE id = dup;
END $$;

ALTER TABLE public.invoices         ENABLE TRIGGER trg_guard_finalized_invoice;
ALTER TABLE public.tube_sale_ledger ENABLE TRIGGER trg_protect_tube_sale_ledger_update;
ALTER TABLE public.tube_sale_ledger ENABLE TRIGGER trg_protect_tube_sale_ledger_delete;