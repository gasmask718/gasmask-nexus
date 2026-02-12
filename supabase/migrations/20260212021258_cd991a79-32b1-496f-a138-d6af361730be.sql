
-- Phase 6.5 — Supplier Cost Forecasting & Predictive Risk (READ-ONLY)

-- 6.5.1 — Cost Trend Projection
CREATE OR REPLACE VIEW public.v_supplier_cost_trend_projection AS
WITH numbered AS (
  SELECT
    supplier_name, product_id, product_name, unit_cost, received_at,
    ROW_NUMBER() OVER (PARTITION BY supplier_name, product_id ORDER BY received_at DESC) AS rn,
    COUNT(*) OVER (PARTITION BY supplier_name, product_id) AS total_receipts
  FROM public.v_supplier_cost_history
),
recent AS (
  SELECT * FROM numbered WHERE rn <= 5 AND total_receipts >= 3
),
endpoints AS (
  SELECT
    supplier_name, product_id, product_name,
    COUNT(*) AS receipts_used,
    AVG(unit_cost) AS recent_avg_unit_cost,
    MAX(received_at) AS last_received_at,
    MAX(CASE WHEN rn = 1 THEN unit_cost END) AS newest_cost,
    -- get oldest cost in the window
    MAX(CASE WHEN rn = (SELECT MAX(r2.rn) FROM recent r2 WHERE r2.supplier_name = recent.supplier_name AND r2.product_id = recent.product_id) THEN unit_cost END) AS oldest_cost
  FROM recent
  GROUP BY supplier_name, product_id, product_name
)
SELECT
  supplier_name, product_id, product_name, receipts_used,
  ROUND(recent_avg_unit_cost::numeric, 4) AS recent_avg_unit_cost,
  ROUND(CASE WHEN receipts_used > 1 THEN (newest_cost - oldest_cost) / NULLIF(receipts_used - 1, 0) ELSE 0 END::numeric, 4) AS recent_cost_slope,
  ROUND((recent_avg_unit_cost + CASE WHEN receipts_used > 1 THEN (newest_cost - oldest_cost) / NULLIF(receipts_used - 1, 0) ELSE 0 END * 6)::numeric, 4) AS projected_unit_cost_30d,
  ROUND((recent_avg_unit_cost + CASE WHEN receipts_used > 1 THEN (newest_cost - oldest_cost) / NULLIF(receipts_used - 1, 0) ELSE 0 END * 12)::numeric, 4) AS projected_unit_cost_60d,
  last_received_at
FROM endpoints;

COMMENT ON VIEW public.v_supplier_cost_trend_projection IS
'Phase 6.5.1 — Projects supplier cost trajectory using last 5 receipts with linear slope. Grain: (supplier_name, product_id). Read-only, droppable.';

-- 6.5.2 — Forecast Risk Alerts
CREATE OR REPLACE VIEW public.v_supplier_forecast_alerts AS
WITH base AS (
  SELECT
    t.supplier_name, t.product_id, t.product_name,
    t.recent_avg_unit_cost AS current_unit_cost,
    t.projected_unit_cost_60d, t.recent_cost_slope, t.receipts_used, t.last_received_at,
    CASE WHEN t.recent_avg_unit_cost > 0
      THEN ROUND(((t.projected_unit_cost_60d - t.recent_avg_unit_cost) / t.recent_avg_unit_cost * 100)::numeric, 2)
      ELSE 0 END AS pct_increase_projected,
    COALESCE(d.pct_change, 0) AS historical_drift_pct
  FROM public.v_supplier_cost_trend_projection t
  LEFT JOIN public.v_supplier_price_drift d ON d.supplier_name = t.supplier_name AND d.product_id = t.product_id
)
SELECT supplier_name, product_id, product_name,
  CASE
    WHEN pct_increase_projected >= 20 THEN 'forecast_increase_20'
    WHEN pct_increase_projected >= 10 THEN 'forecast_increase_10'
    WHEN recent_cost_slope > 0 AND pct_increase_projected > historical_drift_pct THEN 'forecast_accelerating'
  END AS alert_type,
  CASE
    WHEN pct_increase_projected >= 20 THEN 'critical'
    WHEN pct_increase_projected >= 10 THEN 'warning'
    WHEN recent_cost_slope > 0 AND pct_increase_projected > historical_drift_pct THEN 'info'
  END AS severity,
  current_unit_cost, projected_unit_cost_60d, pct_increase_projected, receipts_used, last_received_at
FROM base
WHERE pct_increase_projected >= 10 OR (recent_cost_slope > 0 AND pct_increase_projected > historical_drift_pct);

COMMENT ON VIEW public.v_supplier_forecast_alerts IS
'Phase 6.5.2 — Forward-looking cost risk alerts from trend projections. Grain: (supplier_name, product_id). Read-only, droppable.';

-- 6.5.3 — Forecast Decision Overlay
CREATE OR REPLACE VIEW public.v_supplier_forecast_decision_overlay AS
SELECT
  s.supplier_name, s.product_id, s.product_name,
  s.risk_score, s.risk_band, s.recommended_action,
  COALESCE(f.pct_increase_projected, 0) AS forecast_pct_increase,
  COALESCE(f.severity, 'none') AS forecast_severity,
  f.alert_type AS forecast_alert_type,
  LEAST(ROUND(s.risk_score + CASE
    WHEN f.severity = 'critical' THEN 30
    WHEN f.severity = 'warning'  THEN 15
    WHEN f.severity = 'info'     THEN 5
    ELSE 0 END, 2), 100) AS combined_risk_score,
  CASE
    WHEN f.severity = 'critical' AND s.recommended_action IN ('preferred_supplier','monitor_closely') THEN 'renegotiate'
    WHEN f.severity = 'critical' AND s.recommended_action = 'renegotiate' THEN 'seek_alternative'
    ELSE s.recommended_action
  END AS updated_recommended_action
FROM public.v_supplier_product_scorecard s
LEFT JOIN public.v_supplier_forecast_alerts f ON f.supplier_name = s.supplier_name AND f.product_id = s.product_id;

COMMENT ON VIEW public.v_supplier_forecast_decision_overlay IS
'Phase 6.5.3 — Merges scorecard with forecast alerts for combined_risk_score and upgraded actions. Grain: (supplier_name, product_id). Read-only, droppable.';
