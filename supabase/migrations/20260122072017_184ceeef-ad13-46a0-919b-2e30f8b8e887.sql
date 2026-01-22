-- REPORTING LAYER: Source of Truth Views

-- A) Ambassador Lifetime Financial Summary
CREATE OR REPLACE VIEW v_ambassador_financial_summary AS
SELECT
  a.id AS ambassador_id,
  a.name AS ambassador_name,
  a.user_id,
  COUNT(DISTINCT cl.id) AS commission_count,
  
  COALESCE(SUM(cl.commission_amount) FILTER (WHERE cl.status IN ('pending','approved','paid')), 0) AS lifetime_earned,
  COALESCE(SUM(cl.commission_amount) FILTER (WHERE cl.status = 'pending'), 0) AS pending_amount,
  COALESCE(SUM(cl.commission_amount) FILTER (WHERE cl.status = 'approved'), 0) AS approved_amount,
  COALESCE(SUM(cl.commission_amount) FILTER (WHERE cl.status = 'paid'), 0) AS paid_amount,
  
  COALESCE(SUM(cl.commission_amount) FILTER (WHERE cl.source_channel = 'team_override'), 0) AS override_total,
  
  MIN(cl.earned_at) AS first_earned_at,
  MAX(cl.earned_at) AS last_earned_at

FROM ambassadors a
LEFT JOIN commission_ledger cl ON cl.ambassador_id = a.id
GROUP BY a.id, a.name, a.user_id;

-- B) Period Financial Summary (Month/Quarter/Year)
CREATE OR REPLACE VIEW v_financial_period_summary AS
SELECT
  date_trunc('month', cl.earned_at)::date AS period_month,
  
  COALESCE(SUM(cl.gross_amount), 0) AS gross_revenue,
  COALESCE(SUM(cl.commission_amount), 0) AS total_commissions,
  COALESCE(SUM(cl.commission_amount) FILTER (WHERE cl.source_channel = 'team_override'), 0) AS total_overrides,
  
  COALESCE(SUM(cl.commission_amount) FILTER (WHERE cl.status = 'paid'), 0) AS total_paid,
  
  COALESCE(SUM(cl.commission_amount) FILTER (WHERE cl.status IN ('pending','approved')), 0) AS outstanding_liability,
  
  COUNT(DISTINCT cl.ambassador_id) AS active_ambassadors,
  COUNT(DISTINCT cl.store_id) AS active_stores

FROM commission_ledger cl
GROUP BY date_trunc('month', cl.earned_at)
ORDER BY period_month DESC;

-- C) Store-Level Performance Report
CREATE OR REPLACE VIEW v_store_commission_performance AS
SELECT
  sm.id AS store_id,
  sm.store_name,
  sm.city,
  sm.state,
  
  COUNT(cl.id) AS commission_events,
  COALESCE(SUM(cl.gross_amount), 0) AS store_revenue,
  COALESCE(SUM(cl.commission_amount), 0) AS commissions_generated,
  
  COUNT(DISTINCT cl.ambassador_id) AS ambassadors_involved,
  MAX(cl.earned_at) AS last_activity

FROM store_master sm
LEFT JOIN commission_ledger cl ON cl.store_id = sm.id
GROUP BY sm.id, sm.store_name, sm.city, sm.state;

-- D) Payout Liability Snapshot (USD default)
CREATE OR REPLACE VIEW v_payout_liability_snapshot AS
SELECT
  'USD'::text AS currency,
  COALESCE(SUM(cl.commission_amount), 0) AS liability_amount,
  COUNT(*) AS pending_items
FROM commission_ledger cl
WHERE cl.status = 'approved'
  AND cl.payout_hold = false;

-- E) Annual 1099 Summary (Per Ambassador)
CREATE OR REPLACE VIEW v_ambassador_1099_summary AS
SELECT
  cl.ambassador_id,
  a.name AS ambassador_name,
  a.user_id,
  EXTRACT(YEAR FROM cl.paid_at)::int AS tax_year,
  SUM(cl.commission_amount) AS total_paid,
  COUNT(*) AS payment_count

FROM commission_ledger cl
JOIN ambassadors a ON a.id = cl.ambassador_id
WHERE cl.status = 'paid'
  AND cl.paid_at IS NOT NULL
GROUP BY cl.ambassador_id, a.name, a.user_id, EXTRACT(YEAR FROM cl.paid_at);

-- F) Payout Batch Summary (using actual schema)
CREATE OR REPLACE VIEW v_payout_batch_summary AS
SELECT
  pb.id AS batch_id,
  pb.ambassador_id,
  a.name AS ambassador_name,
  pb.period_start,
  pb.period_end,
  pb.status,
  pb.currency,
  pb.subtotal_amount,
  pb.adjustments_amount,
  pb.total_amount,
  pb.paid_at,
  pb.created_at

FROM payout_batches pb
LEFT JOIN ambassadors a ON a.id = pb.ambassador_id;

-- G) Ambassador Monthly Earnings (for charts)
CREATE OR REPLACE VIEW v_ambassador_monthly_earnings AS
SELECT
  cl.ambassador_id,
  date_trunc('month', cl.earned_at)::date AS month,
  
  COALESCE(SUM(cl.commission_amount), 0) AS total_earned,
  COALESCE(SUM(cl.commission_amount) FILTER (WHERE cl.source_channel = 'team_override'), 0) AS override_earned,
  COALESCE(SUM(cl.commission_amount) FILTER (WHERE cl.source_channel != 'team_override'), 0) AS direct_earned,
  
  COALESCE(SUM(cl.commission_amount) FILTER (WHERE cl.status = 'paid'), 0) AS paid_amount,
  COALESCE(SUM(cl.commission_amount) FILTER (WHERE cl.status IN ('pending','approved')), 0) AS pending_amount

FROM commission_ledger cl
GROUP BY cl.ambassador_id, date_trunc('month', cl.earned_at)
ORDER BY month DESC;

-- Grant access
GRANT SELECT ON v_ambassador_financial_summary TO authenticated;
GRANT SELECT ON v_financial_period_summary TO authenticated;
GRANT SELECT ON v_store_commission_performance TO authenticated;
GRANT SELECT ON v_payout_liability_snapshot TO authenticated;
GRANT SELECT ON v_ambassador_1099_summary TO authenticated;
GRANT SELECT ON v_payout_batch_summary TO authenticated;
GRANT SELECT ON v_ambassador_monthly_earnings TO authenticated;