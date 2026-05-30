-- 1) Add relationship_status column with CHECK to 9 states (default 'Non-active (New - need to speak)')
ALTER TABLE public.store_master
  ADD COLUMN IF NOT EXISTS relationship_status text
  NOT NULL
  DEFAULT 'Non-active (New - need to speak)';

ALTER TABLE public.store_master
  DROP CONSTRAINT IF EXISTS store_master_relationship_status_check;

ALTER TABLE public.store_master
  ADD CONSTRAINT store_master_relationship_status_check
  CHECK (relationship_status IN (
    'Active (Good)',
    'Non-active (New - need to speak)',
    'Follow-up (secure relationship)',
    'Not interested',
    'Not interested - sold in past',
    'No tobacco',
    'Selling slow',
    'Need promo (bring samples)',
    'Closed permanently'
  ));

-- 2) Backfill from legacy free-text status (per approved mapping)
UPDATE public.store_master SET relationship_status =
  CASE
    WHEN status IS NULL THEN 'Non-active (New - need to speak)'
    WHEN status ILIKE 'active%' THEN 'Active (Good)'
    WHEN status = 'BRING NEW ORDER' THEN 'Active (Good)'
    WHEN status ILIKE 'follow up%' OR status ILIKE 'FOLLOW UP%' THEN 'Follow-up (secure relationship)'
    WHEN status = 'Speak' OR status = 'NEW -1' THEN 'Non-active (New - need to speak)'
    WHEN status = 'Starter Kit' THEN 'Need promo (bring samples)'
    ELSE 'Non-active (New - need to speak)'
  END;

CREATE INDEX IF NOT EXISTS idx_store_master_relationship_status
  ON public.store_master(relationship_status)
  WHERE deleted_at IS NULL;

-- 3) Dispatch-eligibility helper (excludes 'Closed permanently')
CREATE OR REPLACE FUNCTION public.is_dispatch_eligible_store(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT relationship_status <> 'Closed permanently'
       FROM public.store_master
      WHERE id = _store_id AND deleted_at IS NULL),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_dispatch_eligible_store(uuid) TO anon, authenticated, service_role;

-- 4) Rollup view — state / city / neighborhood, with one column per status + total
CREATE OR REPLACE VIEW public.v_store_relationship_rollup AS
SELECT
  COALESCE(NULLIF(TRIM(sm.state), ''), 'Unspecified') AS state,
  COALESCE(NULLIF(TRIM(sm.city), ''),  'Unspecified') AS city,
  COALESCE(b.name, 'Unspecified')                     AS neighborhood,
  sm.borough_id,
  COUNT(*)                                                                                  AS total,
  COUNT(*) FILTER (WHERE sm.relationship_status = 'Active (Good)')                          AS active_good,
  COUNT(*) FILTER (WHERE sm.relationship_status = 'Non-active (New - need to speak)')       AS non_active_new,
  COUNT(*) FILTER (WHERE sm.relationship_status = 'Follow-up (secure relationship)')        AS follow_up,
  COUNT(*) FILTER (WHERE sm.relationship_status = 'Not interested')                         AS not_interested,
  COUNT(*) FILTER (WHERE sm.relationship_status = 'Not interested - sold in past')          AS not_interested_sold_past,
  COUNT(*) FILTER (WHERE sm.relationship_status = 'No tobacco')                             AS no_tobacco,
  COUNT(*) FILTER (WHERE sm.relationship_status = 'Selling slow')                           AS selling_slow,
  COUNT(*) FILTER (WHERE sm.relationship_status = 'Need promo (bring samples)')             AS need_promo,
  COUNT(*) FILTER (WHERE sm.relationship_status = 'Closed permanently')                     AS closed_permanently
FROM public.store_master sm
LEFT JOIN public.boroughs b ON b.id = sm.borough_id
WHERE sm.deleted_at IS NULL
GROUP BY 1, 2, 3, sm.borough_id;

GRANT SELECT ON public.v_store_relationship_rollup TO anon, authenticated, service_role;