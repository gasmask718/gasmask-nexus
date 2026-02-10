
-- ============================================================
-- FLOOR 0 INTELLIGENCE LAYER — Read-Only Territory Views
-- These views compute territory awareness and domination metrics
-- from existing Floor 0 tables. No mutations, no CRM interaction.
-- ============================================================

-- 1) v_territory_neighborhood_kpis
-- Per-neighborhood breakdown of address discovery progress.
-- Powers: neighborhood list, coverage heat, priority targeting.
CREATE OR REPLACE VIEW public.v_territory_neighborhood_kpis AS
SELECT
  tn.id AS neighborhood_id,
  tn.name,
  tn.city,
  tn.state,
  tn.target_store_count,
  COUNT(ta.id)::int AS total_addresses,
  -- Addresses where we know something (any status beyond 'unknown')
  COUNT(ta.id) FILTER (WHERE ta.discovery_status != 'unknown')::int AS addresses_scanned_count,
  COUNT(ta.id) FILTER (WHERE ta.discovery_status = 'verified_store')::int AS verified_store_count,
  -- Candidates: addresses that have at least one candidate record
  COUNT(DISTINCT tsc.territory_address_id) FILTER (WHERE tsc.id IS NOT NULL)::int AS candidate_count,
  -- Dead ends: confirmed non-opportunities
  COUNT(ta.id) FILTER (WHERE ta.discovery_status IN ('not_a_store', 'no_tobacco', 'not_interested'))::int AS dead_end_count,
  COUNT(ta.id) FILTER (WHERE ta.discovery_status = 'unknown')::int AS unknown_count,
  COUNT(ta.id) FILTER (WHERE ta.discovery_status = 'wholesaler')::int AS wholesaler_count,
  -- Coverage: what % of addresses have been touched at all
  CASE WHEN COUNT(ta.id) > 0
    THEN ROUND(
      (COUNT(ta.id) FILTER (WHERE ta.discovery_status != 'unknown')::numeric / COUNT(ta.id)) * 100, 1
    )
    ELSE 0
  END AS coverage_percentage,
  -- Domination status derived from coverage %
  CASE
    WHEN COUNT(ta.id) = 0 THEN 'untouched'
    WHEN (COUNT(ta.id) FILTER (WHERE ta.discovery_status != 'unknown')::numeric / NULLIF(COUNT(ta.id), 0)) * 100 >= 80 THEN 'dominated'
    WHEN (COUNT(ta.id) FILTER (WHERE ta.discovery_status != 'unknown')::numeric / NULLIF(COUNT(ta.id), 0)) * 100 >= 20 THEN 'in_progress'
    ELSE 'untouched'
  END AS domination_status
FROM public.territory_neighborhoods tn
LEFT JOIN public.territory_addresses ta ON ta.neighborhood_id = tn.id
LEFT JOIN public.territory_store_candidates tsc ON tsc.territory_address_id = ta.id
GROUP BY tn.id, tn.name, tn.city, tn.state, tn.target_store_count;

-- Grant read access
GRANT SELECT ON public.v_territory_neighborhood_kpis TO authenticated;

-- 2) v_territory_address_status_summary
-- City/state level rollup of address statuses.
-- Powers: regional overview, expansion planning, multi-city comparison.
CREATE OR REPLACE VIEW public.v_territory_address_status_summary AS
SELECT
  ta.city,
  ta.state,
  COUNT(*)::int AS total_addresses,
  COUNT(*) FILTER (WHERE ta.discovery_status = 'unknown')::int AS unknown_addresses,
  COUNT(*) FILTER (WHERE ta.discovery_status = 'scouted')::int AS scouted_addresses,
  COUNT(*) FILTER (WHERE ta.discovery_status = 'verified_store')::int AS verified_stores,
  COUNT(DISTINCT tsc.territory_address_id) FILTER (WHERE tsc.id IS NOT NULL)::int AS candidates,
  COUNT(*) FILTER (WHERE ta.discovery_status = 'wholesaler')::int AS wholesalers,
  COUNT(*) FILTER (WHERE ta.discovery_status IN ('not_a_store', 'no_tobacco', 'not_interested'))::int AS dead_ends
FROM public.territory_addresses ta
LEFT JOIN public.territory_store_candidates tsc ON tsc.territory_address_id = ta.id
GROUP BY ta.city, ta.state;

GRANT SELECT ON public.v_territory_address_status_summary TO authenticated;

-- 3) v_territory_domination_score
-- Per-neighborhood domination readiness score (0-100) and next action recommendation.
-- Score formula: weighted blend of coverage, verification depth, and candidate conversion.
-- Powers: AI targeting, human prioritization, expansion decisions.
CREATE OR REPLACE VIEW public.v_territory_domination_score AS
SELECT
  tn.id AS neighborhood_id,
  tn.name,
  tn.city,
  tn.state,
  COUNT(ta.id)::int AS total_addresses,
  COUNT(ta.id) FILTER (WHERE ta.discovery_status = 'verified_store')::int AS verified_stores,
  COUNT(ta.id) FILTER (WHERE ta.discovery_status = 'unknown')::int AS missing_addresses_count,
  -- Domination score: 0-100
  -- 40% weight: coverage (scanned / total)
  -- 40% weight: verification depth (verified_store / scanned)
  -- 20% weight: candidate conversion (verified / (verified + candidates))
  CASE WHEN COUNT(ta.id) = 0 THEN 0
  ELSE LEAST(100, ROUND(
    -- Coverage component (40%)
    (COALESCE(COUNT(ta.id) FILTER (WHERE ta.discovery_status != 'unknown')::numeric / NULLIF(COUNT(ta.id), 0), 0)) * 40
    +
    -- Verification depth (40%)
    (COALESCE(
      COUNT(ta.id) FILTER (WHERE ta.discovery_status = 'verified_store')::numeric
      / NULLIF(COUNT(ta.id) FILTER (WHERE ta.discovery_status != 'unknown'), 0),
    0)) * 40
    +
    -- Candidate conversion (20%)
    (COALESCE(
      COUNT(ta.id) FILTER (WHERE ta.discovery_status = 'verified_store')::numeric
      / NULLIF(
        COUNT(ta.id) FILTER (WHERE ta.discovery_status = 'verified_store')
        + COUNT(DISTINCT tsc.territory_address_id) FILTER (WHERE tsc.id IS NOT NULL),
      0),
    0)) * 20
  , 0))
  END AS domination_score,
  -- Next recommended action based on current state
  CASE
    WHEN COUNT(ta.id) = 0 THEN 'scout'
    WHEN (COUNT(ta.id) FILTER (WHERE ta.discovery_status = 'unknown')::numeric / NULLIF(COUNT(ta.id), 0)) > 0.5 THEN 'scout'
    WHEN COUNT(DISTINCT tsc.territory_address_id) FILTER (WHERE tsc.id IS NOT NULL) > COUNT(ta.id) FILTER (WHERE ta.discovery_status = 'verified_store') THEN 'call'
    ELSE 'visit'
  END AS next_recommended_action
FROM public.territory_neighborhoods tn
LEFT JOIN public.territory_addresses ta ON ta.neighborhood_id = tn.id
LEFT JOIN public.territory_store_candidates tsc ON tsc.territory_address_id = ta.id
GROUP BY tn.id, tn.name, tn.city, tn.state;

GRANT SELECT ON public.v_territory_domination_score TO authenticated;
