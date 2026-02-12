
-- Phase 6.6 — Supplier Contract Intelligence & Renegotiation Timing (READ-ONLY)

-- 6.6.1 — Renegotiation Window
CREATE OR REPLACE VIEW public.v_supplier_renegotiation_window AS
SELECT
  o.supplier_name,
  o.product_id,
  o.product_name,
  o.combined_risk_score AS current_risk_score,
  o.forecast_severity,
  o.updated_recommended_action AS recommended_action,
  CASE
    WHEN o.forecast_severity = 'critical' THEN 'immediate'
    WHEN o.combined_risk_score >= 60 THEN 'near_term'
    ELSE 'monitor'
  END AS recommended_contact_window,
  CASE
    WHEN o.forecast_severity = 'critical' THEN 'Forecast projects critical cost increase within 60 days — act within 30 days'
    WHEN o.combined_risk_score >= 60 THEN 'Combined risk score ' || o.combined_risk_score || ' exceeds threshold — schedule contact within 30–60 days'
    WHEN o.forecast_severity = 'warning' THEN 'Warning-level forecast trend detected — monitor and prepare fallback'
    ELSE 'Stable — no action required at this time'
  END AS reason
FROM public.v_supplier_forecast_decision_overlay o;

COMMENT ON VIEW public.v_supplier_renegotiation_window IS
'Phase 6.6.1 — Determines when to act on supplier risk. Grain: (supplier_name, product_id). Read-only, droppable.';

-- 6.6.2 — Contract Risk Index
CREATE OR REPLACE VIEW public.v_supplier_contract_risk_index AS
SELECT
  o.supplier_name,
  o.product_id,
  o.product_name,
  LEAST(ROUND(
    o.combined_risk_score * 0.5
    + CASE o.forecast_severity WHEN 'critical' THEN 30 WHEN 'warning' THEN 15 WHEN 'info' THEN 5 ELSE 0 END
    + COALESCE(o.forecast_pct_increase, 0) * 0.5
  , 2), 100) AS contract_risk_index,
  CASE
    WHEN LEAST(ROUND(o.combined_risk_score * 0.5 + CASE o.forecast_severity WHEN 'critical' THEN 30 WHEN 'warning' THEN 15 WHEN 'info' THEN 5 ELSE 0 END + COALESCE(o.forecast_pct_increase, 0) * 0.5, 2), 100) >= 75 THEN 'critical'
    WHEN LEAST(ROUND(o.combined_risk_score * 0.5 + CASE o.forecast_severity WHEN 'critical' THEN 30 WHEN 'warning' THEN 15 WHEN 'info' THEN 5 ELSE 0 END + COALESCE(o.forecast_pct_increase, 0) * 0.5, 2), 100) >= 50 THEN 'high'
    WHEN LEAST(ROUND(o.combined_risk_score * 0.5 + CASE o.forecast_severity WHEN 'critical' THEN 30 WHEN 'warning' THEN 15 WHEN 'info' THEN 5 ELSE 0 END + COALESCE(o.forecast_pct_increase, 0) * 0.5, 2), 100) >= 25 THEN 'medium'
    ELSE 'low'
  END AS risk_tier,
  CASE
    WHEN o.forecast_pct_increase >= 20 THEN 'forecast_increase'
    WHEN o.risk_score > 50 AND o.forecast_pct_increase < 10 THEN 'volatility'
    WHEN o.forecast_pct_increase >= 10 AND o.risk_score > 40 THEN 'mixed'
    ELSE 'margin_pressure'
  END AS primary_risk_driver
FROM public.v_supplier_forecast_decision_overlay o;

COMMENT ON VIEW public.v_supplier_contract_risk_index IS
'Phase 6.6.2 — Quantifies business exposure per supplier-product if no action taken. Grain: (supplier_name, product_id). Read-only, droppable.';

-- 6.6.3 — Negotiation Priority Queue
CREATE OR REPLACE VIEW public.v_supplier_negotiation_queue AS
SELECT
  ROW_NUMBER() OVER (ORDER BY c.contract_risk_index DESC, w.recommended_contact_window = 'immediate' DESC, c.primary_risk_driver) AS priority_rank,
  c.supplier_name,
  c.product_name,
  c.contract_risk_index,
  w.recommended_action,
  w.recommended_contact_window,
  w.reason AS summary_reason
FROM public.v_supplier_contract_risk_index c
JOIN public.v_supplier_renegotiation_window w
  ON w.supplier_name = c.supplier_name AND w.product_id = c.product_id
WHERE w.recommended_contact_window IN ('immediate', 'near_term')
ORDER BY priority_rank;

COMMENT ON VIEW public.v_supplier_negotiation_queue IS
'Phase 6.6.3 — Single operational queue: who to call first, when, and why. Grain: (supplier_name, product_id). Read-only, droppable.';
