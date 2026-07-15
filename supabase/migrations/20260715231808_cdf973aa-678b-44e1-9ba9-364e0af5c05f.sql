
-- ============================================================================
-- DEDUP RUN f7b3c284 — atomic snapshot + field merge + delete of 284 duplicates
-- Run UUID: f7b3c284-0000-4000-8000-000000000000
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- STEP 2: SNAPSHOT TABLES (full row preservation for rollback)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public._dedup_snap_f7b3c284 AS
  SELECT s.*, NULL::uuid AS survivor_store_id, now() AS snapped_at
  FROM public.stores s WHERE false;
GRANT ALL ON public._dedup_snap_f7b3c284 TO service_role;
ALTER TABLE public._dedup_snap_f7b3c284 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role only" ON public._dedup_snap_f7b3c284;
CREATE POLICY "service_role only" ON public._dedup_snap_f7b3c284 TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public._dedup_snap_notes_f7b3c284 AS
  SELECT n.*, now() AS snapped_at FROM public.store_notes n WHERE false;
GRANT ALL ON public._dedup_snap_notes_f7b3c284 TO service_role;
ALTER TABLE public._dedup_snap_notes_f7b3c284 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role only" ON public._dedup_snap_notes_f7b3c284;
CREATE POLICY "service_role only" ON public._dedup_snap_notes_f7b3c284 TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public._dedup_snap_invoices_f7b3c284 AS
  SELECT i.*, now() AS snapped_at FROM public.invoices i WHERE false;
GRANT ALL ON public._dedup_snap_invoices_f7b3c284 TO service_role;
ALTER TABLE public._dedup_snap_invoices_f7b3c284 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role only" ON public._dedup_snap_invoices_f7b3c284;
CREATE POLICY "service_role only" ON public._dedup_snap_invoices_f7b3c284 TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public._dedup_merge_log_f7b3c284 (
  survivor_store_id uuid NOT NULL,
  survivor_name text,
  action text,          -- 'set_primary' | 'set_alt' | 'skipped_primary_present' | 'skipped_alt_present'
  old_phone text,
  old_alt_phone text,
  new_value text,
  applied_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public._dedup_merge_log_f7b3c284 TO service_role;
ALTER TABLE public._dedup_merge_log_f7b3c284 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role only" ON public._dedup_merge_log_f7b3c284;
CREATE POLICY "service_role only" ON public._dedup_merge_log_f7b3c284 TO service_role USING (true) WITH CHECK (true);

-- Snapshot inserts
INSERT INTO public._dedup_snap_f7b3c284
SELECT s.*, p.survivor_store_id, now()
FROM public.stores s
JOIN public._dedup_pairs p ON p.delete_store_id = s.id;

INSERT INTO public._dedup_snap_notes_f7b3c284
SELECT n.*, now()
FROM public.store_notes n
WHERE n.store_id IN (SELECT delete_store_id FROM public._dedup_pairs);

INSERT INTO public._dedup_snap_invoices_f7b3c284
SELECT i.*, now()
FROM public.invoices i
WHERE i.store_id IN (SELECT delete_store_id FROM public._dedup_pairs);

-- ---------------------------------------------------------------------------
-- GUARD: snapshot store rows must equal 284
-- ---------------------------------------------------------------------------
DO $$
DECLARE snap_ct int; note_ct int; inv_ct int;
BEGIN
  SELECT count(*) INTO snap_ct FROM public._dedup_snap_f7b3c284;
  SELECT count(*) INTO note_ct FROM public._dedup_snap_notes_f7b3c284;
  SELECT count(*) INTO inv_ct  FROM public._dedup_snap_invoices_f7b3c284;
  RAISE NOTICE 'SNAPSHOT: stores=%, notes=%, invoices=%', snap_ct, note_ct, inv_ct;
  IF snap_ct <> 284 THEN
    RAISE EXCEPTION 'ABORT: snapshot store count % <> 284', snap_ct;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- STEP 3a: FIELD MERGE — 24 survivors, phone fill or alt_phone
-- Rule: never overwrite existing primary phone. If primary blank -> set primary.
--       Else if alt_phone blank -> set alt_phone. Else skip and log.
-- Blank primary = NULL, '', '—', or contains no digits.
-- ---------------------------------------------------------------------------

-- Log intent for every merge row (pre-image + planned action)
INSERT INTO public._dedup_merge_log_f7b3c284
  (survivor_store_id, survivor_name, action, old_phone, old_alt_phone, new_value)
SELECT
  m.survivor_store_id,
  m.survivor_name,
  CASE
    WHEN s.phone IS NULL OR btrim(s.phone) = '' OR btrim(s.phone) = '—'
         OR regexp_replace(coalesce(s.phone,''), '\D', '', 'g') = ''
      THEN 'set_primary'
    WHEN s.alt_phone IS NULL OR btrim(s.alt_phone) = ''
      THEN 'set_alt'
    WHEN regexp_replace(coalesce(s.alt_phone,''), '\D', '', 'g')
         = regexp_replace(coalesce(m.extra_phones,''), '\D', '', 'g')
      THEN 'skipped_alt_already_matches'
    ELSE 'skipped_alt_present'
  END,
  s.phone,
  s.alt_phone,
  m.extra_phones
FROM public._dedup_merge m
JOIN public.stores s ON s.id = m.survivor_store_id;

-- Apply: primary phone fill (blank primary)
UPDATE public.stores s
SET phone = m.extra_phones,
    updated_at = now()
FROM public._dedup_merge m
WHERE s.id = m.survivor_store_id
  AND (s.phone IS NULL OR btrim(s.phone) = '' OR btrim(s.phone) = '—'
       OR regexp_replace(coalesce(s.phone,''), '\D', '', 'g') = '');

-- Apply: alt_phone fill (primary present, alt blank)
UPDATE public.stores s
SET alt_phone = m.extra_phones,
    updated_at = now()
FROM public._dedup_merge m
WHERE s.id = m.survivor_store_id
  AND NOT (s.phone IS NULL OR btrim(s.phone) = '' OR btrim(s.phone) = '—'
           OR regexp_replace(coalesce(s.phone,''), '\D', '', 'g') = '')
  AND (s.alt_phone IS NULL OR btrim(s.alt_phone) = '');

-- ---------------------------------------------------------------------------
-- STEP 3b: RE-POINT notes + invoices from delete-targets to survivors
-- ---------------------------------------------------------------------------
UPDATE public.store_notes n
SET store_id = p.survivor_store_id
FROM public._dedup_pairs p
WHERE n.store_id = p.delete_store_id;

UPDATE public.invoices i
SET store_id = p.survivor_store_id
FROM public._dedup_pairs p
WHERE i.store_id = p.delete_store_id;

-- GUARD: no orphans remain before delete
DO $$
DECLARE orphan_notes int; orphan_invs int;
BEGIN
  SELECT count(*) INTO orphan_notes FROM public.store_notes
    WHERE store_id IN (SELECT delete_store_id FROM public._dedup_pairs);
  SELECT count(*) INTO orphan_invs FROM public.invoices
    WHERE store_id IN (SELECT delete_store_id FROM public._dedup_pairs);
  RAISE NOTICE 'POST-REPOINT: orphan_notes=%, orphan_invoices=%', orphan_notes, orphan_invs;
  IF orphan_notes <> 0 OR orphan_invs <> 0 THEN
    RAISE EXCEPTION 'ABORT: orphans remain (notes=%, invoices=%)', orphan_notes, orphan_invs;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- STEP 4: DELETE 284 duplicate store rows
-- ---------------------------------------------------------------------------
WITH del AS (
  DELETE FROM public.stores
  WHERE id IN (SELECT delete_store_id FROM public._dedup_pairs)
  RETURNING id
)
INSERT INTO public._dedup_merge_log_f7b3c284
  (survivor_store_id, survivor_name, action, new_value)
SELECT
  '00000000-0000-0000-0000-000000000000'::uuid,
  NULL,
  'deleted_count',
  count(*)::text
FROM del;

-- GUARD: deletion count must be 284, survivors must all remain
DO $$
DECLARE deleted_ct int; surv_ct int; still_there int;
BEGIN
  SELECT new_value::int INTO deleted_ct
    FROM public._dedup_merge_log_f7b3c284
    WHERE action = 'deleted_count' ORDER BY applied_at DESC LIMIT 1;
  SELECT count(*) INTO still_there FROM public.stores
    WHERE id IN (SELECT delete_store_id FROM public._dedup_pairs);
  SELECT count(DISTINCT s.id) INTO surv_ct FROM public.stores s
    WHERE s.id IN (SELECT survivor_store_id FROM public._dedup_pairs);
  RAISE NOTICE 'DELETE: deleted=%, remaining_delete_targets=%, survivors_intact=%',
    deleted_ct, still_there, surv_ct;
  IF deleted_ct <> 284 THEN
    RAISE EXCEPTION 'ABORT: deleted % (expected 284)', deleted_ct;
  END IF;
  IF still_there <> 0 THEN
    RAISE EXCEPTION 'ABORT: % delete-targets still present after delete', still_there;
  END IF;
  IF surv_ct <> 179 THEN
    RAISE EXCEPTION 'ABORT: survivors present=% (expected 179)', surv_ct;
  END IF;
END $$;

COMMIT;
