
-- ── 1. Extend sales_prospects.source enum to include gm_gap_scan ─────────────
ALTER TABLE public.sales_prospects DROP CONSTRAINT IF EXISTS sales_prospects_source_check;
ALTER TABLE public.sales_prospects ADD CONSTRAINT sales_prospects_source_check
  CHECK (source = ANY (ARRAY[
    'walk-in','instagram','referral','cold-call','event',
    'ambassador_referral','store_referral','wholesaler_referral','influencer_referral',
    'ambassador','website','social_media','trade_show','word_of_mouth','other',
    'gm_gap_scan'
  ]));

-- ── 2. gm_neighborhood_scans (operator audit + 30d re-scan guard) ────────────
CREATE TABLE IF NOT EXISTS public.gm_neighborhood_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id uuid NOT NULL REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  triggered_by uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed')),
  query_terms text[] NOT NULL DEFAULT ARRAY['smoke shop','convenience store','deli','bodega'],
  pois_found integer NOT NULL DEFAULT 0,
  pois_matched integer NOT NULL DEFAULT 0,
  new_prospects integer NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gm_neighborhood_scans TO authenticated;
GRANT ALL ON public.gm_neighborhood_scans TO service_role;
ALTER TABLE public.gm_neighborhood_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read gm_neighborhood_scans" ON public.gm_neighborhood_scans
  FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_gm_scans_neighborhood_started
  ON public.gm_neighborhood_scans(neighborhood_id, started_at DESC);

-- ── 3. gm_discovered_pois (cache + diff source) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.gm_discovered_pois (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid REFERENCES public.gm_neighborhood_scans(id) ON DELETE SET NULL,
  neighborhood_id uuid NOT NULL REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  place_id text NOT NULL,
  name text,
  address text,
  phone text,
  category text,
  lat double precision,
  lng double precision,
  matched_store_id uuid REFERENCES public.store_master(id) ON DELETE SET NULL,
  promoted_prospect_id uuid REFERENCES public.sales_prospects(id) ON DELETE SET NULL,
  match_reason text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (neighborhood_id, place_id)
);
GRANT SELECT ON public.gm_discovered_pois TO authenticated;
GRANT ALL ON public.gm_discovered_pois TO service_role;
ALTER TABLE public.gm_discovered_pois ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read gm_discovered_pois" ON public.gm_discovered_pois
  FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_gm_pois_neighborhood ON public.gm_discovered_pois(neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_gm_pois_unmatched
  ON public.gm_discovered_pois(neighborhood_id)
  WHERE matched_store_id IS NULL AND promoted_prospect_id IS NULL;

-- ── 4. default_cadence_days(status) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.default_cadence_days(status text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE status
    WHEN 'Active (Good)'                    THEN 14
    WHEN 'Follow-up (secure relationship)'  THEN 7
    WHEN 'Need promo (bring samples)'       THEN 10
    WHEN 'Selling slow'                     THEN 21
    WHEN 'Non-active (New - need to speak)' THEN 30
    WHEN 'Not interested'                   THEN NULL
    WHEN 'Not interested - sold in past'    THEN NULL
    WHEN 'No tobacco'                       THEN NULL
    WHEN 'Closed permanently'               THEN NULL
    ELSE 30
  END;
$$;

-- ── 5. v_store_order_baseline ────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_store_order_baseline AS
WITH win AS (
  SELECT
    i.store_id,
    COUNT(DISTINCT i.id) AS order_count_90d,
    COALESCE(SUM(li.quantity), 0)::numeric AS units_90d
  FROM public.invoices i
  LEFT JOIN public.invoice_line_items li ON li.invoice_id = i.id
  WHERE i.created_at >= now() - INTERVAL '90 days'
    AND i.store_id IS NOT NULL
  GROUP BY i.store_id
)
SELECT
  store_id,
  order_count_90d,
  units_90d,
  ROUND(units_90d / 3.0, 2) AS avg_monthly_units
FROM win
WHERE order_count_90d >= 2;

GRANT SELECT ON public.v_store_order_baseline TO authenticated;

-- ── 6. v_store_at_risk ──────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_store_at_risk AS
WITH current_window AS (
  SELECT i.store_id, COALESCE(SUM(li.quantity), 0)::numeric AS units_30d
  FROM public.invoices i
  LEFT JOIN public.invoice_line_items li ON li.invoice_id = i.id
  WHERE i.created_at >= now() - INTERVAL '30 days'
    AND i.store_id IS NOT NULL
  GROUP BY i.store_id
)
SELECT
  b.store_id,
  b.avg_monthly_units AS baseline_monthly_units,
  COALESCE(c.units_30d, 0) AS current_30d_units,
  ROUND(COALESCE(c.units_30d, 0) / NULLIF(b.avg_monthly_units, 0) * 100, 1) AS pct_of_baseline,
  sm.relationship_status
FROM public.v_store_order_baseline b
LEFT JOIN current_window c ON c.store_id = b.store_id
LEFT JOIN public.store_master sm ON sm.id = b.store_id
WHERE COALESCE(c.units_30d, 0) < (b.avg_monthly_units * 0.5)
  AND COALESCE(sm.relationship_status, '') NOT IN (
    'Closed permanently','Not interested','Not interested - sold in past','No tobacco'
  );

GRANT SELECT ON public.v_store_at_risk TO authenticated;

-- ── 7. Recreate v_route_candidates with bring_samples / win_back / at_risk ──
DROP VIEW IF EXISTS public.v_route_candidates;
CREATE VIEW public.v_route_candidates AS
-- existing lanes (unchanged)
SELECT s.id AS store_id, s.name AS store_name, s.address_street AS address,
  s.address_city AS city, s.neighborhood, s.boro,
  'reorder'::text AS candidate_type, 'inventory'::text AS signal_source,
  'Low stock — needs reorder'::text AS reason,
  'Low stock — needs reorder'::text AS why,
  3 AS priority, 0::numeric AS value, s.last_visit_date,
  max(t.last_updated_at) AS signal_at
FROM public.stores s
JOIN public.store_tube_inventory_status t ON t.store_id = s.id AND t.needs_order = true
WHERE s.deleted_at IS NULL AND s.approval_status = 'approved'
GROUP BY s.id

UNION ALL
SELECT s.id, s.name, s.address_street, s.address_city, s.neighborhood, s.boro,
  COALESCE(prs.signal_source, 'owner_order'),
  COALESCE(prs.signal_source, 'owner_order'),
  COALESCE(prs.reason, prs.intent_summary, 'Owner requested order'),
  COALESCE(prs.reason, prs.intent_summary, 'Owner requested order'),
  COALESCE(prs.priority, CASE prs.urgency WHEN 'today' THEN 5 WHEN 'this_week' THEN 4 ELSE 3 END),
  COALESCE(prs.estimated_revenue, 0), s.last_visit_date, prs.created_at
FROM public.pending_route_stops prs
JOIN public.stores s ON s.id = prs.store_id
WHERE prs.status = 'pending_approval' AND s.deleted_at IS NULL

UNION ALL
SELECT s.id, s.name, s.address_street, s.address_city, s.neighborhood, s.boro,
  'collect_payment', 'invoices',
  'Unpaid balance: $' || round(sum(COALESCE(i.total_amount, i.total, 0) - COALESCE(i.amount_paid, 0)), 2)::text,
  'Unpaid balance: $' || round(sum(COALESCE(i.total_amount, i.total, 0) - COALESCE(i.amount_paid, 0)), 2)::text,
  4, sum(COALESCE(i.total_amount, i.total, 0) - COALESCE(i.amount_paid, 0)), s.last_visit_date, max(i.created_at)
FROM public.invoices i JOIN public.stores s ON s.id = i.store_id
WHERE i.payment_status IN ('unpaid','partial') AND s.deleted_at IS NULL
GROUP BY s.id
HAVING sum(COALESCE(i.total_amount, i.total, 0) - COALESCE(i.amount_paid, 0)) > 0

UNION ALL
SELECT s.id, s.name, s.address_street, s.address_city, s.neighborhood, s.boro,
  'follow_up', 'follow_up_queue',
  COALESCE(fq.reason, 'Follow-up scheduled'),
  COALESCE(fq.reason, 'Follow-up scheduled'),
  COALESCE(fq.priority, 3), 0, s.last_visit_date, fq.created_at
FROM public.follow_up_queue fq JOIN public.stores s ON s.id = fq.store_id
WHERE COALESCE(fq.status, 'pending') = 'pending' AND s.deleted_at IS NULL

UNION ALL
SELECT s.id, s.name, s.address_street, s.address_city, s.neighborhood, s.boro,
  'prospect', 'prospect',
  'Prospect — no visit in 30+ days',
  'Prospect — no visit in 30+ days',
  2, 0, s.last_visit_date, s.updated_at
FROM public.stores s
WHERE s.deleted_at IS NULL AND s.status = 'prospect'::store_status
  AND (s.last_visit_date IS NULL OR s.last_visit_date < now() - INTERVAL '30 days')

-- ── NEW: bring_samples (Need promo / Selling slow, stale) ──
UNION ALL
SELECT s.id, s.name, s.address_street, s.address_city, s.neighborhood, s.boro,
  'bring_samples', 'relationship_status',
  'Bring samples — ' || sm.relationship_status,
  'Bring samples — ' || sm.relationship_status,
  4, 0, s.last_visit_date, COALESCE(s.last_visit_date, sm.updated_at)
FROM public.stores s
JOIN public.store_master sm ON sm.id = s.id
WHERE s.deleted_at IS NULL
  AND sm.relationship_status IN ('Need promo (bring samples)','Selling slow')
  AND (s.last_visit_date IS NULL OR s.last_visit_date < now() - INTERVAL '21 days')

-- ── NEW: win_back (Active but cold) ──
UNION ALL
SELECT s.id, s.name, s.address_street, s.address_city, s.neighborhood, s.boro,
  'win_back', 'order_recency',
  'Win-back — last order ' ||
    EXTRACT(DAY FROM now() - sm.last_order_date)::int::text || ' days ago',
  'Win-back — last order ' ||
    EXTRACT(DAY FROM now() - sm.last_order_date)::int::text || ' days ago',
  4, 0, s.last_visit_date, sm.last_order_date
FROM public.stores s
JOIN public.store_master sm ON sm.id = s.id
WHERE s.deleted_at IS NULL
  AND sm.relationship_status = 'Active (Good)'
  AND sm.last_order_date IS NOT NULL
  AND sm.last_order_date < now() - INTERVAL '45 days'

-- ── NEW: at_risk (own-baseline slowdown) ──
UNION ALL
SELECT s.id, s.name, s.address_street, s.address_city, s.neighborhood, s.boro,
  'at_risk', 'velocity',
  'At-risk — ordering ' || COALESCE(ar.pct_of_baseline, 0)::text || '% of own baseline',
  'At-risk — ordering ' || COALESCE(ar.pct_of_baseline, 0)::text || '% of own baseline',
  5, ar.baseline_monthly_units, s.last_visit_date, now()
FROM public.v_store_at_risk ar
JOIN public.stores s ON s.id = ar.store_id
WHERE s.deleted_at IS NULL;

GRANT SELECT ON public.v_route_candidates TO authenticated;
