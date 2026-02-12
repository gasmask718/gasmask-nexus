
-- Drop dependent views first (CASCADE would work but being explicit)
DROP VIEW IF EXISTS public.v_supplier_scorecard CASCADE;
DROP VIEW IF EXISTS public.v_supplier_rankings CASCADE;
DROP VIEW IF EXISTS public.v_supplier_decision_matrix CASCADE;
DROP VIEW IF EXISTS public.v_supplier_product_scorecard CASCADE;

-- 6.3.1 Supplier-Product Scorecard
CREATE VIEW public.v_supplier_product_scorecard AS
WITH base AS (
  SELECT
    sch.supplier_name, sch.product_id, sch.product_name,
    COUNT(*)::int AS receipts_count,
    AVG(sch.unit_cost)::numeric AS avg_unit_cost,
    MIN(sch.unit_cost)::numeric AS min_unit_cost,
    MAX(sch.unit_cost)::numeric AS max_unit_cost
  FROM public.v_supplier_cost_history sch
  GROUP BY sch.supplier_name, sch.product_id, sch.product_name
),
joined AS (
  SELECT b.*,
    COALESCE(d.pct_change, 0) AS pct_change,
    COALESCE(v.volatility_pct, 0) AS volatility_pct,
    d.first_unit_cost, d.latest_unit_cost,
    d.first_received_at, d.latest_received_at
  FROM base b
  LEFT JOIN public.v_supplier_price_drift d ON d.supplier_name = b.supplier_name AND d.product_id = b.product_id
  LEFT JOIN public.v_supplier_cost_volatility v ON v.supplier_name = b.supplier_name AND v.product_id = b.product_id
),
scored AS (
  SELECT j.*,
    LEAST(ROUND((ABS(j.pct_change) * 2) + (j.volatility_pct * 1.5) + CASE WHEN j.receipts_count < 3 THEN 15 ELSE 0 END, 2), 100) AS risk_score
  FROM joined j
)
SELECT
  supplier_name, product_id, product_name, receipts_count,
  ROUND(avg_unit_cost, 4) AS avg_unit_cost,
  ROUND(COALESCE(first_unit_cost, min_unit_cost), 4) AS baseline_unit_cost,
  ROUND(COALESCE(latest_unit_cost, max_unit_cost), 4) AS latest_unit_cost,
  ROUND(min_unit_cost, 4) AS min_unit_cost,
  ROUND(max_unit_cost, 4) AS max_unit_cost,
  ROUND(pct_change::numeric, 2) AS pct_change,
  ROUND(volatility_pct::numeric, 2) AS volatility_pct,
  first_received_at, latest_received_at,
  risk_score,
  ROUND(GREATEST(100 - risk_score, 0), 2) AS overall_score,
  CASE WHEN risk_score <= 20 THEN 'healthy' WHEN risk_score <= 40 THEN 'watch' WHEN risk_score <= 60 THEN 'risk' ELSE 'critical' END AS risk_band,
  CASE WHEN risk_score <= 20 THEN 'preferred_supplier' WHEN pct_change BETWEEN 10 AND 20 AND volatility_pct < 15 THEN 'renegotiate' WHEN volatility_pct >= 15 AND risk_score <= 60 THEN 'monitor_closely' WHEN risk_score > 60 THEN 'seek_alternative' ELSE 'monitor_closely' END AS recommended_action
FROM scored ORDER BY supplier_name, product_name;

COMMENT ON VIEW public.v_supplier_product_scorecard IS 'Supplier-product scorecard (read-only). Risk score = ABS(drift)*2 + volatility*1.5 + low-receipt penalty. Bands: healthy(0-20), watch(21-40), risk(41-60), critical(>60). Safe to drop.';

-- 6.3.2 Supplier Rankings
CREATE VIEW public.v_supplier_rankings AS
WITH supplier_agg AS (
  SELECT supplier_name,
    COUNT(DISTINCT product_id)::int AS products_count,
    SUM(receipts_count)::int AS total_receipts_count,
    ROUND(AVG(risk_score), 2) AS avg_risk_score,
    ROUND(AVG(overall_score), 2) AS overall_score,
    ROUND(AVG(pct_change::numeric), 2) AS avg_pct_change,
    ROUND(AVG(volatility_pct::numeric), 2) AS avg_volatility_pct,
    MODE() WITHIN GROUP (ORDER BY risk_band) AS dominant_risk_band
  FROM public.v_supplier_product_scorecard GROUP BY supplier_name
)
SELECT sa.*, RANK() OVER (ORDER BY sa.overall_score DESC) AS rank_overall
FROM supplier_agg sa ORDER BY rank_overall, supplier_name;

COMMENT ON VIEW public.v_supplier_rankings IS 'Supplier rankings (read-only). Aggregates product scorecards into supplier-level rank. Safe to drop.';

-- 6.3.3 Decision Matrix
CREATE VIEW public.v_supplier_decision_matrix AS
SELECT supplier_name, product_id, product_name, risk_score, risk_band, pct_change, volatility_pct, receipts_count, recommended_action, baseline_unit_cost, latest_unit_cost,
  CASE WHEN recommended_action = 'seek_alternative' THEN 1 WHEN recommended_action = 'renegotiate' THEN 2 WHEN recommended_action = 'monitor_closely' THEN 3 WHEN recommended_action = 'preferred_supplier' THEN 4 ELSE 5 END AS action_priority
FROM public.v_supplier_product_scorecard ORDER BY action_priority, risk_score DESC;

COMMENT ON VIEW public.v_supplier_decision_matrix IS 'Supplier decision matrix (read-only). Maps risk scores to actionable recommendations. Safe to drop.';

-- 6.3.4 Rollup Scorecard
CREATE VIEW public.v_supplier_scorecard AS
SELECT supplier_name, products_count, total_receipts_count, avg_risk_score, overall_score,
  overall_score AS cost_score,
  ROUND(GREATEST(100 - avg_pct_change * 5, 0), 2) AS trend_score,
  ROUND(GREATEST(100 - avg_volatility_pct * 4, 0), 2) AS stability_score,
  CASE WHEN total_receipts_count >= 20 THEN 100 WHEN total_receipts_count <= 1 THEN 20 ELSE ROUND(20 + (total_receipts_count::numeric - 1) * (80.0 / 19), 2) END AS reliability_score,
  dominant_risk_band, rank_overall
FROM public.v_supplier_rankings;

COMMENT ON VIEW public.v_supplier_scorecard IS 'Supplier rollup scorecard (read-only). Derives from v_supplier_rankings with component scores. Safe to drop.';
