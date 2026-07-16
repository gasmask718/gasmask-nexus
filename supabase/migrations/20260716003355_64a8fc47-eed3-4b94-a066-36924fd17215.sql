
DO $mig$
DECLARE
  v_run_id uuid := 'cf1a4b02-9d3e-4f11-b7c1-8e7c9a5f4d21';
  v_snap_pairs text := '_cfin_snap_pairs_cf1a4b02';
  v_snap_clean text := '_cfin_snap_cleanup_cf1a4b02';
  v_snap_inv text := '_cfin_snap_invoices_cf1a4b02';
  v_swaps int; v_snap_pair_cnt int; v_snap_clean_cnt int; v_snap_inv_cnt int;
  v_phones_merged int; v_phones_alt int; v_inv_repointed int;
  v_deleted_pairs int; v_deleted_clean int; v_skipped_clean int;
  v_survivors_live int; v_survivors_total int;
BEGIN
PERFORM set_config('app.merge_in_progress', 'true', true);

WITH to_swap AS (
  SELECT p.delete_id, p.survivor_id FROM _cfin_pairs p
  JOIN stores sd ON sd.id = p.delete_id JOIN stores ss ON ss.id = p.survivor_id
  WHERE sd.deleted_at IS NULL AND ss.deleted_at IS NOT NULL
)
UPDATE _cfin_pairs p
SET delete_id = p.survivor_id, delete_name = p.survivor_name,
    survivor_id = p.delete_id, survivor_name = p.delete_name
FROM to_swap s
WHERE p.delete_id = s.delete_id AND p.survivor_id = s.survivor_id;
GET DIAGNOSTICS v_swaps = ROW_COUNT;

EXECUTE format('CREATE TABLE IF NOT EXISTS public.%I AS SELECT s.*, now() AS snapped_at FROM stores s WHERE false', v_snap_pairs);
EXECUTE format('INSERT INTO public.%I SELECT s.*, now() FROM stores s WHERE s.id IN (SELECT delete_id FROM _cfin_pairs)', v_snap_pairs);
EXECUTE format('SELECT count(*) FROM public.%I', v_snap_pairs) INTO v_snap_pair_cnt;

EXECUTE format('CREATE TABLE IF NOT EXISTS public.%I AS SELECT s.*, now() AS snapped_at FROM stores s WHERE false', v_snap_clean);
EXECUTE format('INSERT INTO public.%I SELECT s.*, now() FROM stores s WHERE s.id IN (SELECT delete_id FROM _cfin_cleanup)', v_snap_clean);
EXECUTE format('SELECT count(*) FROM public.%I', v_snap_clean) INTO v_snap_clean_cnt;

EXECUTE format('CREATE TABLE IF NOT EXISTS public.%I AS SELECT i.*, now() AS snapped_at FROM invoices i WHERE false', v_snap_inv);
EXECUTE format('INSERT INTO public.%I SELECT i.*, now() FROM invoices i WHERE i.store_id IN (SELECT delete_id FROM _cfin_pairs UNION SELECT delete_id FROM _cfin_cleanup)', v_snap_inv);
EXECUTE format('SELECT count(*) FROM public.%I', v_snap_inv) INTO v_snap_inv_cnt;

EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_snap_pairs);
EXECUTE format('DROP POLICY IF EXISTS srv_all ON public.%I', v_snap_pairs);
EXECUTE format('CREATE POLICY srv_all ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', v_snap_pairs);
EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_snap_clean);
EXECUTE format('DROP POLICY IF EXISTS srv_all ON public.%I', v_snap_clean);
EXECUTE format('CREATE POLICY srv_all ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', v_snap_clean);
EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_snap_inv);
EXECUTE format('DROP POLICY IF EXISTS srv_all ON public.%I', v_snap_inv);
EXECUTE format('CREATE POLICY srv_all ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', v_snap_inv);

WITH merged AS (
  UPDATE stores s SET phone = d.phone, last_update_run_id = v_run_id, updated_at = now()
  FROM _cfin_pairs p JOIN stores d ON d.id = p.delete_id
  WHERE s.id = p.survivor_id
    AND (s.phone IS NULL OR btrim(s.phone) = '')
    AND d.phone IS NOT NULL AND btrim(d.phone) <> ''
  RETURNING 1
) SELECT count(*) INTO v_phones_merged FROM merged;

WITH alt_merged AS (
  UPDATE stores s SET alt_phone = d.phone, last_update_run_id = v_run_id, updated_at = now()
  FROM _cfin_pairs p JOIN stores d ON d.id = p.delete_id
  WHERE s.id = p.survivor_id
    AND (s.alt_phone IS NULL OR btrim(s.alt_phone) = '')
    AND d.phone IS NOT NULL AND btrim(d.phone) <> ''
    AND coalesce(btrim(s.phone),'') <> btrim(d.phone)
  RETURNING 1
) SELECT count(*) INTO v_phones_alt FROM alt_merged;
v_phones_merged := v_phones_merged + v_phones_alt;

WITH rp AS (
  UPDATE invoices i SET store_id = p.survivor_id
  FROM _cfin_pairs p WHERE i.store_id = p.delete_id
  RETURNING 1
) SELECT count(*) INTO v_inv_repointed FROM rp;

IF EXISTS (SELECT 1 FROM invoices WHERE store_id IN (SELECT delete_id FROM _cfin_pairs)) THEN
  RAISE EXCEPTION 'Orphan invoices remain on pair delete-targets';
END IF;

WITH d AS (DELETE FROM stores WHERE id IN (SELECT delete_id FROM _cfin_pairs) RETURNING 1)
SELECT count(*) INTO v_deleted_pairs FROM d;

-- Only delete cleanup rows that have NO dependent invoices (preserve ledger history)
WITH deletable AS (
  SELECT delete_id FROM _cfin_cleanup c
  WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.store_id = c.delete_id)
),
d AS (DELETE FROM stores WHERE id IN (SELECT delete_id FROM deletable) RETURNING 1)
SELECT count(*) INTO v_deleted_clean FROM d;
v_skipped_clean := v_snap_clean_cnt - v_deleted_clean;

UPDATE stores SET deleted_at = NULL, last_update_run_id = v_run_id, updated_at = now()
WHERE id IN (SELECT DISTINCT survivor_id FROM _cfin_pairs) AND deleted_at IS NOT NULL;

SELECT count(*) INTO v_survivors_total FROM stores WHERE id IN (SELECT DISTINCT survivor_id FROM _cfin_pairs);
SELECT count(*) INTO v_survivors_live  FROM stores WHERE id IN (SELECT DISTINCT survivor_id FROM _cfin_pairs) AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public._cfin_run_summary (
  run_id uuid PRIMARY KEY, swaps int, snap_pairs int, snap_cleanup int, snap_invoices int,
  phones_merged int, invoices_repointed int, deleted_pairs int, deleted_cleanup int,
  cleanup_skipped_due_to_invoices int,
  survivors_distinct int, survivors_live int, ran_at timestamptz DEFAULT now()
);
GRANT ALL ON public._cfin_run_summary TO service_role;
ALTER TABLE public._cfin_run_summary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS srv_all ON public._cfin_run_summary;
CREATE POLICY srv_all ON public._cfin_run_summary FOR ALL TO service_role USING (true) WITH CHECK (true);
INSERT INTO public._cfin_run_summary VALUES
  (v_run_id, v_swaps, v_snap_pair_cnt, v_snap_clean_cnt, v_snap_inv_cnt,
   v_phones_merged, v_inv_repointed, v_deleted_pairs, v_deleted_clean, v_skipped_clean,
   v_survivors_total, v_survivors_live, now())
ON CONFLICT (run_id) DO NOTHING;

PERFORM set_config('app.merge_in_progress', 'false', true);
END $mig$;
