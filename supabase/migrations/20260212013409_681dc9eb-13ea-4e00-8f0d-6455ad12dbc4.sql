-- Phase 6.2: Price Drift Signals (READ-ONLY ANALYTICS)
-- Three analytical views deriving supplier cost movement and volatility
-- Foundation for Phase 6.3 supplier scorecards

-- 6.2.1: v_supplier_price_drift
-- Core signal: Detect directional cost movement over time
-- Grain: (supplier_name, product_id)
CREATE OR REPLACE VIEW public.v_supplier_price_drift AS
SELECT
  schist.supplier_name,
  schist.product_id,
  schist.product_name,
  
  MIN(schist.unit_cost) FILTER (WHERE rn_first = 1) AS first_unit_cost,
  MAX(schist.unit_cost) FILTER (WHERE rn_last = 1) AS latest_unit_cost,
  
  ROUND(
    (MAX(schist.unit_cost) FILTER (WHERE rn_last = 1) - MIN(schist.unit_cost) FILTER (WHERE rn_first = 1))::numeric,
    4
  ) AS absolute_change,
  
  ROUND(
    (
      (MAX(schist.unit_cost) FILTER (WHERE rn_last = 1) - MIN(schist.unit_cost) FILTER (WHERE rn_first = 1))
      / NULLIF(MIN(schist.unit_cost) FILTER (WHERE rn_first = 1), 0)
    )::numeric * 100,
    2
  ) AS pct_change,
  
  MIN(schist.received_at) FILTER (WHERE rn_first = 1) AS first_received_at,
  MAX(schist.received_at) FILTER (WHERE rn_last = 1) AS latest_received_at,
  
  COUNT(*) AS receipts_count
  
FROM (
  SELECT
    supplier_name,
    product_id,
    product_name,
    unit_cost,
    received_at,
    ROW_NUMBER() OVER (PARTITION BY supplier_name, product_id ORDER BY received_at ASC) AS rn_first,
    ROW_NUMBER() OVER (PARTITION BY supplier_name, product_id ORDER BY received_at DESC) AS rn_last
  FROM v_supplier_cost_history
) schist

GROUP BY schist.supplier_name, schist.product_id, schist.product_name
HAVING COUNT(*) >= 2

ORDER BY schist.supplier_name, schist.product_id;

COMMENT ON VIEW public.v_supplier_price_drift IS
'Price drift signals: directional cost movement per supplier-product.
Grain: (supplier_name, product_id).
Shows first cost, latest cost, absolute change, percent change, receipt dates, and count.
Excludes products with < 2 receipts.
Foundation for detecting supplier cost creep.';


-- 6.2.2: v_supplier_cost_volatility
-- Measure pricing instability (even if trend is flat)
-- Grain: (supplier_name, product_id)
CREATE OR REPLACE VIEW public.v_supplier_cost_volatility AS
SELECT
  supplier_name,
  product_id,
  product_name,
  
  ROUND(AVG(unit_cost)::numeric, 4) AS avg_unit_cost,
  ROUND(STDDEV_POP(unit_cost)::numeric, 4) AS stddev_unit_cost,
  ROUND(MIN(unit_cost)::numeric, 4) AS min_unit_cost,
  ROUND(MAX(unit_cost)::numeric, 4) AS max_unit_cost,
  
  COUNT(*) AS receipts_count,
  
  ROUND(
    (STDDEV_POP(unit_cost) / NULLIF(AVG(unit_cost), 0) * 100)::numeric,
    2
  ) AS volatility_pct

FROM v_supplier_cost_history

GROUP BY supplier_name, product_id, product_name
HAVING COUNT(*) >= 2

ORDER BY volatility_pct DESC, supplier_name, product_id;

COMMENT ON VIEW public.v_supplier_cost_volatility IS
'Cost volatility signals: pricing instability per supplier-product.
Grain: (supplier_name, product_id).
Shows average, standard deviation, min, max costs, receipt count, and volatility percentage.
Excludes products with < 2 receipts.
Identifies unstable pricing patterns independent of directional trend.';


-- 6.2.3: v_supplier_price_alerts
-- Human-readable alerts derived from drift and volatility
-- Thresholds: ±10% directional change, ≥15% volatility
CREATE OR REPLACE VIEW public.v_supplier_price_alerts AS
SELECT
  COALESCE(drift.supplier_name, vol.supplier_name) AS supplier_name,
  COALESCE(drift.product_id, vol.product_id) AS product_id,
  COALESCE(drift.product_name, vol.product_name) AS product_name,
  
  CASE
    WHEN drift.pct_change >= 10 THEN 'price_increase'
    WHEN drift.pct_change <= -10 THEN 'price_drop'
    WHEN vol.volatility_pct >= 15 THEN 'volatile_pricing'
  END AS alert_type,
  
  CASE
    WHEN drift.pct_change >= 20 THEN 'critical'
    WHEN drift.pct_change >= 10 THEN 'warning'
    WHEN drift.pct_change <= -20 THEN 'critical'
    WHEN drift.pct_change <= -10 THEN 'warning'
    WHEN vol.volatility_pct >= 25 THEN 'critical'
    WHEN vol.volatility_pct >= 15 THEN 'warning'
    ELSE 'info'
  END AS severity,
  
  ROUND(drift.pct_change::numeric, 2) AS pct_change,
  ROUND(drift.latest_unit_cost::numeric, 4) AS latest_unit_cost,
  ROUND(drift.first_unit_cost::numeric, 4) AS baseline_unit_cost,
  ROUND(vol.volatility_pct::numeric, 2) AS volatility_pct,
  
  drift.receipts_count,
  drift.first_received_at,
  drift.latest_received_at

FROM v_supplier_price_drift drift
FULL OUTER JOIN v_supplier_cost_volatility vol
  ON drift.supplier_name = vol.supplier_name
  AND drift.product_id = vol.product_id

WHERE
  drift.pct_change >= 10
  OR drift.pct_change <= -10
  OR vol.volatility_pct >= 15

ORDER BY severity DESC, supplier_name, product_id;

COMMENT ON VIEW public.v_supplier_price_alerts IS
'Price alert summary: human-readable flags for cost drift and volatility.
Alerts: price_increase (≥+10%), price_drop (≤-10%), volatile_pricing (volatility ≥15%).
Severity: critical (drift ≥±20% or volatility ≥25%), warning, info.
Read-only. Safe to drop without affecting Phases 4–5.
Foundation for Phase 6.3+ scorecard and UI integration.';