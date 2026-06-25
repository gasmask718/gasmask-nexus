
-- ============================================================
-- Phase 6 — Merge Engine Data Governance (T2 / T3 / T4)
-- ============================================================

-- ───────── T2: Phase E.5 Smart-Rename Pass ─────────
CREATE TABLE IF NOT EXISTS public.merge_engine_rename_pass_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid NOT NULL,
  old_name      text NOT NULL,
  proposed_name text NOT NULL,
  reason        text NOT NULL,
  applied       boolean NOT NULL DEFAULT false,
  collided      boolean NOT NULL DEFAULT false,
  collision_with uuid,
  run_id        uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.merge_engine_rename_pass_log TO authenticated;
GRANT ALL            ON public.merge_engine_rename_pass_log TO service_role;

ALTER TABLE public.merge_engine_rename_pass_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read rename log"   ON public.merge_engine_rename_pass_log;
DROP POLICY IF EXISTS "admins write rename log"  ON public.merge_engine_rename_pass_log;

CREATE POLICY "admins read rename log"
  ON public.merge_engine_rename_pass_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "admins write rename log"
  ON public.merge_engine_rename_pass_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE INDEX IF NOT EXISTS idx_rename_log_run    ON public.merge_engine_rename_pass_log(run_id);
CREATE INDEX IF NOT EXISTS idx_rename_log_store  ON public.merge_engine_rename_pass_log(store_id);

-- Smart cleaner: returns NULL when nothing to clean (don't touch the row).
CREATE OR REPLACE FUNCTION public.merge_engine_clean_name(_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  cleaned text := _name;
BEGIN
  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RETURN NULL;
  END IF;

  -- Strip known pre-merge artifacts only — no blanket prefix removal.
  cleaned := regexp_replace(cleaned, '^\s*\[MERGED\]\s*[-:]?\s*', '', 'i');
  cleaned := regexp_replace(cleaned, '^\s*MERGED\s*[-:]\s*',      '', 'i');
  cleaned := regexp_replace(cleaned, '^\s*DUP[-_:]\s*',           '', 'i');
  cleaned := regexp_replace(cleaned, '^\s*OLD[-_:]\s*',           '', 'i');
  cleaned := regexp_replace(cleaned, '^\s*ZZZ[-_:]\s*',           '', 'i');
  cleaned := regexp_replace(cleaned, '\s*\(deleted\)\s*$',        '', 'i');
  cleaned := regexp_replace(cleaned, '\s*--\s*duplicate\s*$',     '', 'i');
  cleaned := regexp_replace(cleaned, '\s{2,}', ' ', 'g');
  cleaned := trim(cleaned);

  IF cleaned = _name OR length(cleaned) = 0 THEN
    RETURN NULL;
  END IF;

  RETURN cleaned;
END;
$$;

-- Phase E.5 driver. Default = dry-run (logs only, no UPDATEs).
-- Per merge-engine-rename-gap memory: log-only by default; collisions are skipped.
CREATE OR REPLACE FUNCTION public.merge_engine_smart_rename_pass(
  _dry_run boolean DEFAULT true,
  _limit   integer DEFAULT 5000
)
RETURNS TABLE(run_id uuid, scanned int, proposed int, applied int, collided int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid := gen_random_uuid();
  v_scanned int := 0;
  v_proposed int := 0;
  v_applied int := 0;
  v_collided int := 0;
  r record;
  v_clean text;
  v_collision uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')) THEN
    RAISE EXCEPTION 'merge_engine_smart_rename_pass: admin/owner required';
  END IF;

  FOR r IN
    SELECT id, name, address_street, address_city, address_state
    FROM public.stores
    WHERE deleted_at IS NULL
      AND name ~* '^(\s*(\[MERGED\]|MERGED\s*[-:]|DUP[-_:]|OLD[-_:]|ZZZ[-_:]))|(\(deleted\)\s*$)|(--\s*duplicate\s*$)'
    ORDER BY updated_at DESC NULLS LAST
    LIMIT _limit
  LOOP
    v_scanned := v_scanned + 1;
    v_clean := public.merge_engine_clean_name(r.name);
    IF v_clean IS NULL THEN
      CONTINUE;
    END IF;

    -- Collision guard: refuse if another live store at the same address already
    -- holds the cleaned name (case-insensitive).
    SELECT id INTO v_collision
    FROM public.stores
    WHERE id <> r.id
      AND deleted_at IS NULL
      AND lower(name) = lower(v_clean)
      AND coalesce(address_street,'') = coalesce(r.address_street,'')
      AND coalesce(address_city,'')   = coalesce(r.address_city,'')
      AND coalesce(address_state,'')  = coalesce(r.address_state,'')
    LIMIT 1;

    v_proposed := v_proposed + 1;

    IF v_collision IS NOT NULL THEN
      v_collided := v_collided + 1;
      INSERT INTO public.merge_engine_rename_pass_log
        (store_id, old_name, proposed_name, reason, applied, collided, collision_with, run_id)
      VALUES (r.id, r.name, v_clean, 'smart_rename_pass_e5', false, true, v_collision, v_run_id);
      CONTINUE;
    END IF;

    INSERT INTO public.merge_engine_rename_pass_log
      (store_id, old_name, proposed_name, reason, applied, collided, run_id)
    VALUES (r.id, r.name, v_clean, 'smart_rename_pass_e5', NOT _dry_run, false, v_run_id);

    IF NOT _dry_run THEN
      UPDATE public.stores SET name = v_clean, updated_at = now() WHERE id = r.id;
      v_applied := v_applied + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_run_id, v_scanned, v_proposed, v_applied, v_collided;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.merge_engine_smart_rename_pass(boolean, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.merge_engine_smart_rename_pass(boolean, integer) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.merge_engine_smart_rename_pass(boolean, integer) TO service_role;

-- ───────── T3: Address-keyed override + survivor scoring ─────────
CREATE OR REPLACE FUNCTION public.merge_find_override_for_address(_normalized_address text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT manual_winner_store_id
  FROM public.dynasty_merge_overrides
  WHERE normalized_address = _normalized_address
  ORDER BY set_at DESC NULLS LAST
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.merge_find_override_for_address(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.merge_find_override_for_address(text) TO authenticated, service_role;

-- Survivor scoring rule: higher = better merge target.
-- Weighs identity completeness, recency, sticker status, tag richness.
CREATE OR REPLACE FUNCTION public.merge_survivor_score(_store_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  score int := 0;
BEGIN
  SELECT * INTO s FROM public.stores WHERE id = _store_id;
  IF NOT FOUND OR s.deleted_at IS NOT NULL THEN
    RETURN -1;
  END IF;

  IF s.phone   IS NOT NULL AND length(s.phone)   > 0 THEN score := score + 25; END IF;
  IF s.email   IS NOT NULL AND length(s.email)   > 0 THEN score := score + 10; END IF;
  IF s.address_street IS NOT NULL                        THEN score := score + 10; END IF;
  IF s.sticker_status = 'active'                         THEN score := score + 20; END IF;
  IF s.status = 'active'                                 THEN score := score + 15; END IF;
  IF s.last_visit_date IS NOT NULL
     AND s.last_visit_date > now() - interval '90 days'  THEN score := score + 15; END IF;
  IF s.last_active_date IS NOT NULL
     AND s.last_active_date > now() - interval '180 days' THEN score := score + 10; END IF;
  IF s.tags IS NOT NULL AND array_length(s.tags, 1) > 0  THEN score := score + 5;  END IF;
  IF s.alt_phone IS NOT NULL AND length(s.alt_phone) > 0 THEN score := score + 5;  END IF;

  RETURN score;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.merge_survivor_score(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.merge_survivor_score(uuid) TO authenticated, service_role;

-- ───────── T4: Orphan candidates view (excludes dedup-skipped) ─────────
-- Per merge-dedup-skipped-orphans memory: dedup-skipped child rows on soft-deleted
-- losers are EXPECTED. They must be excluded from orphan counts and never hard-deleted.
CREATE OR REPLACE VIEW public.v_merge_orphan_candidates
WITH (security_invoker = true)
AS
SELECT
  s.id                AS store_id,
  s.name              AS store_name,
  s.deleted_at,
  s.address_street,
  s.address_city,
  s.address_state,
  s.updated_at
FROM public.stores s
WHERE s.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.dedupe_suggestions ds
    WHERE ds.entity_type = 'store'
      AND (ds.entity_id = s.id OR ds.duplicate_id = s.id)
      AND ds.status IN ('skipped', 'rejected', 'dedup_skipped', 'kept')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.dynasty_merge_skiplist sk
    WHERE sk.normalized_address = lower(trim(coalesce(s.address_street,'') || ' ' ||
                                              coalesce(s.address_city,'')   || ' ' ||
                                              coalesce(s.address_state,'')))
  );

GRANT SELECT ON public.v_merge_orphan_candidates TO authenticated, service_role;

COMMENT ON VIEW public.v_merge_orphan_candidates IS
  'Orphan classification for cleanup jobs. Explicitly excludes dedup-skipped rows (per merge-dedup-skipped-orphans memory) so they are never hard-deleted.';
