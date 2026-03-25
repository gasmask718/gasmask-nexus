
-- MONEY ENGINE: Unified Financial Intelligence Layer (Views only)

-- 1. UNIFIED REVENUE VIEW
CREATE OR REPLACE VIEW public.v_money_revenue AS
SELECT
  'invoice' AS source, i.id AS source_id, i.invoice_number, i.store_id,
  i.entity_type, i.entity_id, i.entry_mode,
  COALESCE(i.total_amount, i.total, 0) AS gross_amount,
  COALESCE(i.amount_paid, 0) AS amount_collected,
  COALESCE(i.total_amount, i.total, 0) - COALESCE(i.amount_paid, 0) AS ar_balance,
  i.payment_status, i.status AS invoice_status, i.due_date, i.created_at, i.paid_at, i.is_historical,
  CASE
    WHEN i.payment_status = 'paid' THEN 'collected'
    WHEN i.payment_status = 'partial' THEN 'partial'
    WHEN i.due_date IS NOT NULL AND i.due_date::timestamp < now() AND i.payment_status != 'paid' THEN 'overdue'
    ELSE 'outstanding'
  END AS collection_status,
  CASE WHEN i.due_date IS NULL THEN NULL WHEN i.payment_status = 'paid' THEN 0
    ELSE GREATEST(0, EXTRACT(day FROM now() - i.due_date::timestamp))::int END AS days_overdue,
  CASE
    WHEN i.due_date IS NULL OR i.payment_status = 'paid' THEN 'current'
    WHEN now() <= i.due_date::timestamp THEN 'current'
    WHEN EXTRACT(day FROM now() - i.due_date::timestamp) BETWEEN 1 AND 7 THEN '1-7 days'
    WHEN EXTRACT(day FROM now() - i.due_date::timestamp) BETWEEN 8 AND 14 THEN '8-14 days'
    WHEN EXTRACT(day FROM now() - i.due_date::timestamp) BETWEEN 15 AND 30 THEN '15-30 days'
    WHEN EXTRACT(day FROM now() - i.due_date::timestamp) BETWEEN 31 AND 60 THEN '31-60 days'
    ELSE '60+ days'
  END AS aging_bucket
FROM invoices i WHERE i.deleted_at IS NULL AND i.status != 'voided'
UNION ALL
SELECT
  'customer_invoice', ci.id, ci.invoice_number, NULL::uuid, 'customer', ci.customer_id,
  ci.entry_mode, COALESCE(ci.total_amount, 0), 0, COALESCE(ci.total_amount, 0),
  ci.status, ci.status, ci.due_date, ci.created_at, NULL::timestamptz, ci.is_historical,
  CASE WHEN ci.status = 'paid' THEN 'collected'
    WHEN ci.due_date IS NOT NULL AND ci.due_date < current_date AND ci.status != 'paid' THEN 'overdue'
    ELSE 'outstanding' END,
  CASE WHEN ci.due_date IS NULL THEN NULL WHEN ci.status = 'paid' THEN 0
    ELSE GREATEST(0, current_date - ci.due_date) END,
  CASE WHEN ci.due_date IS NULL OR ci.status = 'paid' THEN 'current'
    WHEN current_date <= ci.due_date THEN 'current'
    WHEN current_date - ci.due_date BETWEEN 1 AND 7 THEN '1-7 days'
    WHEN current_date - ci.due_date BETWEEN 8 AND 14 THEN '8-14 days'
    WHEN current_date - ci.due_date BETWEEN 15 AND 30 THEN '15-30 days'
    WHEN current_date - ci.due_date BETWEEN 31 AND 60 THEN '31-60 days'
    ELSE '60+ days' END
FROM customer_invoices ci
UNION ALL
SELECT
  'marketplace', mo.id, NULL, NULL::uuid, 'marketplace', mo.user_id,
  'live', COALESCE(mo.total, 0),
  CASE WHEN mo.payment_status = 'paid' THEN COALESCE(mo.total, 0) ELSE 0 END,
  CASE WHEN mo.payment_status = 'paid' THEN 0 ELSE COALESCE(mo.total, 0) END,
  mo.payment_status, mo.payment_status, NULL::date, mo.created_at, NULL::timestamptz, false,
  CASE WHEN mo.payment_status = 'paid' THEN 'collected' ELSE 'outstanding' END,
  0, 'current'
FROM marketplace_orders mo;

-- 2. UNIFIED COST VIEW
CREATE OR REPLACE VIEW public.v_money_costs AS
SELECT 'production' AS cost_type, pb.id AS source_id, NULL::uuid AS store_id, NULL::uuid AS invoice_id,
  'manufacturing' AS category, COALESCE(bch.total_batch_cost, 0) AS amount,
  COALESCE(bch.labor_cost, 0) AS labor_component, COALESCE(bch.tobacco_cost, 0) AS material_component,
  COALESCE(bch.packaging_cost, 0) AS packaging_component, COALESCE(bch.overhead_cost, 0) AS overhead_component,
  pb.created_at
FROM production_batches pb
LEFT JOIN batch_cost_history bch ON bch.batch_id = pb.id
WHERE pb.status IN ('completed', 'approved')
UNION ALL
SELECT 'cogs', cl.id, NULL::uuid, cl.invoice_id, 'cost_of_goods_sold', COALESCE(cl.total_cost, 0),
  0, COALESCE(cl.total_cost, 0), 0, 0, cl.recorded_at
FROM cogs_ledger cl
UNION ALL
SELECT 'labor', wp.id, NULL::uuid, NULL::uuid, wp.worker_type, COALESCE(wp.total_to_pay, 0),
  COALESCE(wp.total_to_pay, 0), 0, 0, 0, wp.created_at
FROM worker_payouts wp
UNION ALL
SELECT 'shipping', sl.id, NULL::uuid, NULL::uuid, 'delivery', COALESCE(sl.label_cost, 0),
  0, 0, COALESCE(sl.label_cost, 0), 0, sl.created_at
FROM shipping_labels sl
UNION ALL
SELECT 'commission', cl2.id, cl2.store_id, NULL::uuid, 'sales_commission', COALESCE(cl2.commission_amount, 0),
  COALESCE(cl2.commission_amount, 0), 0, 0, 0, cl2.created_at
FROM commission_ledger cl2
UNION ALL
SELECT 'wholesaler_payout', wsp.id, NULL::uuid, NULL::uuid, 'marketplace_payout', COALESCE(wsp.net_amount, 0),
  0, 0, 0, 0, wsp.created_at
FROM wholesaler_payouts wsp;

-- 3. PROFIT SUMMARY VIEW
CREATE OR REPLACE VIEW public.v_money_profit_summary AS
WITH revenue AS (
  SELECT date_trunc('month', created_at)::date AS period,
    sum(gross_amount) AS gross_revenue, sum(amount_collected) AS cash_collected,
    sum(ar_balance) AS ar_outstanding, count(*) AS invoice_count
  FROM v_money_revenue GROUP BY 1
),
costs AS (
  SELECT date_trunc('month', created_at)::date AS period,
    sum(amount) AS total_costs,
    sum(amount) FILTER (WHERE cost_type = 'production') AS production_costs,
    sum(amount) FILTER (WHERE cost_type = 'cogs') AS cogs_allocated,
    sum(amount) FILTER (WHERE cost_type = 'labor') AS labor_costs,
    sum(amount) FILTER (WHERE cost_type = 'shipping') AS shipping_costs,
    sum(amount) FILTER (WHERE cost_type = 'commission') AS commission_costs
  FROM v_money_costs GROUP BY 1
)
SELECT COALESCE(r.period, c.period) AS period,
  COALESCE(r.gross_revenue, 0) AS gross_revenue, COALESCE(r.cash_collected, 0) AS cash_collected,
  COALESCE(r.ar_outstanding, 0) AS ar_outstanding, COALESCE(r.invoice_count, 0) AS invoice_count,
  COALESCE(c.total_costs, 0) AS total_costs, COALESCE(c.production_costs, 0) AS production_costs,
  COALESCE(c.cogs_allocated, 0) AS cogs_allocated, COALESCE(c.labor_costs, 0) AS labor_costs,
  COALESCE(c.shipping_costs, 0) AS shipping_costs, COALESCE(c.commission_costs, 0) AS commission_costs,
  COALESCE(r.gross_revenue, 0) - COALESCE(c.total_costs, 0) AS gross_profit,
  CASE WHEN COALESCE(r.gross_revenue, 0) > 0
    THEN round((COALESCE(r.gross_revenue, 0) - COALESCE(c.total_costs, 0)) / r.gross_revenue, 4)
    ELSE 0 END AS gross_margin_pct
FROM revenue r FULL OUTER JOIN costs c ON r.period = c.period
ORDER BY COALESCE(r.period, c.period) DESC;

-- 4. STORE PROFITABILITY VIEW
CREATE OR REPLACE VIEW public.v_money_store_profitability AS
SELECT r.store_id, sm.store_name, count(*) AS total_invoices,
  sum(r.gross_amount) AS lifetime_revenue, sum(r.amount_collected) AS lifetime_collected,
  sum(r.ar_balance) AS open_balance,
  CASE WHEN count(*) > 0 THEN sum(r.gross_amount) / count(*) ELSE 0 END AS avg_order_value,
  count(*) FILTER (WHERE r.collection_status = 'overdue') AS overdue_count,
  COALESCE(sum(r.ar_balance) FILTER (WHERE r.collection_status = 'overdue'), 0) AS overdue_amount,
  CASE WHEN count(*) FILTER (WHERE r.payment_status = 'paid') > 0
    THEN round(avg(EXTRACT(day FROM r.paid_at - r.created_at)) FILTER (WHERE r.payment_status = 'paid'), 1)
    ELSE NULL END AS avg_days_to_pay,
  CASE
    WHEN sum(r.gross_amount) >= 10000 AND COALESCE(sum(r.ar_balance) FILTER (WHERE r.collection_status = 'overdue'), 0) = 0 THEN 'elite'
    WHEN sum(r.gross_amount) >= 5000 AND COALESCE(count(*) FILTER (WHERE r.collection_status = 'overdue'), 0) <= 1 THEN 'strong'
    WHEN sum(r.gross_amount) >= 1000 THEN 'average'
    WHEN sum(r.gross_amount) >= 200 THEN 'weak'
    WHEN COALESCE(count(*) FILTER (WHERE r.collection_status = 'overdue'), 0) > 2 THEN 'at_risk'
    ELSE 'new'
  END AS store_class
FROM v_money_revenue r
LEFT JOIN store_master sm ON sm.id = r.store_id
WHERE r.store_id IS NOT NULL
GROUP BY r.store_id, sm.store_name;

-- 5. AR AGING VIEW
CREATE OR REPLACE VIEW public.v_money_ar_aging AS
SELECT aging_bucket, count(*) AS invoice_count,
  sum(ar_balance) AS total_ar, sum(gross_amount) AS total_billed
FROM v_money_revenue
WHERE collection_status IN ('outstanding', 'overdue', 'partial')
GROUP BY aging_bucket
ORDER BY CASE aging_bucket
  WHEN 'current' THEN 1 WHEN '1-7 days' THEN 2 WHEN '8-14 days' THEN 3
  WHEN '15-30 days' THEN 4 WHEN '31-60 days' THEN 5 WHEN '60+ days' THEN 6 END;

-- 6. CASH NOW VIEW
CREATE OR REPLACE VIEW public.v_money_cash_now AS
SELECT
  COALESCE(sum(amount_collected) FILTER (WHERE created_at >= date_trunc('day', now())), 0) AS cash_today,
  COALESCE(sum(amount_collected) FILTER (WHERE created_at >= date_trunc('week', now())), 0) AS cash_this_week,
  COALESCE(sum(amount_collected) FILTER (WHERE created_at >= date_trunc('month', now())), 0) AS cash_this_month,
  COALESCE(sum(amount_collected) FILTER (WHERE created_at >= date_trunc('year', now())), 0) AS cash_this_year,
  COALESCE(sum(gross_amount), 0) AS total_billed,
  COALESCE(sum(amount_collected), 0) AS total_collected,
  COALESCE(sum(ar_balance), 0) AS total_ar,
  COALESCE(sum(ar_balance) FILTER (WHERE collection_status = 'overdue'), 0) AS overdue_ar,
  count(*) AS total_invoices,
  count(*) FILTER (WHERE collection_status = 'overdue') AS overdue_count,
  COALESCE(sum(ar_balance) FILTER (WHERE due_date IS NOT NULL AND due_date::timestamp BETWEEN now() AND now() + interval '7 days'), 0) AS due_next_7d,
  COALESCE(sum(ar_balance) FILTER (WHERE due_date IS NOT NULL AND due_date::timestamp BETWEEN now() AND now() + interval '14 days'), 0) AS due_next_14d,
  COALESCE(sum(ar_balance) FILTER (WHERE due_date IS NOT NULL AND due_date::timestamp BETWEEN now() AND now() + interval '30 days'), 0) AS due_next_30d
FROM v_money_revenue;

-- 7. BRAND PROFITABILITY VIEW
CREATE OR REPLACE VIEW public.v_money_brand_profitability AS
SELECT li.brand_id, li.brand AS brand_name,
  count(DISTINCT li.invoice_id) AS invoice_count,
  sum(li.line_subtotal) AS total_revenue,
  sum(COALESCE(cogs.total_cogs, 0)) AS total_cogs,
  sum(li.line_subtotal) - sum(COALESCE(cogs.total_cogs, 0)) AS gross_profit,
  CASE WHEN sum(li.line_subtotal) > 0
    THEN round((sum(li.line_subtotal) - sum(COALESCE(cogs.total_cogs, 0))) / sum(li.line_subtotal), 4)
    ELSE 0 END AS margin_pct
FROM invoice_line_items li
JOIN invoices inv ON inv.id = li.invoice_id
LEFT JOIN (SELECT line_item_id, sum(total_cost) AS total_cogs FROM cogs_ledger GROUP BY line_item_id) cogs ON cogs.line_item_id = li.id
WHERE inv.status = 'finalized' AND inv.deleted_at IS NULL
GROUP BY li.brand_id, li.brand;

-- 8. HEALTH CHECK VIEW
CREATE OR REPLACE VIEW public.v_money_health_check AS
SELECT
  (SELECT count(*) FROM invoices WHERE deleted_at IS NULL AND status != 'voided') AS total_invoices,
  (SELECT coalesce(sum(total_amount),0) FROM invoices WHERE deleted_at IS NULL AND status != 'voided') AS total_billed,
  (SELECT coalesce(sum(amount_paid),0) FROM invoices WHERE deleted_at IS NULL AND status != 'voided') AS total_collected,
  (SELECT count(*) FROM cogs_ledger) AS cogs_entries,
  (SELECT count(*) FROM batch_cost_history) AS batch_cost_entries,
  (SELECT count(*) FROM worker_payouts) AS worker_payout_entries,
  (SELECT count(*) FROM commission_ledger) AS commission_entries,
  (SELECT count(*) FROM invoices WHERE deleted_at IS NULL AND payment_status = 'paid' AND status = 'draft') AS draft_paid_mismatches,
  (SELECT count(*) FROM invoices WHERE deleted_at IS NULL AND due_date IS NULL AND status = 'finalized') AS missing_due_dates,
  (SELECT count(*) FROM invoice_line_items WHERE cost_per_unit_at_sale > 0 AND cost_per_unit_at_sale > line_subtotal) AS suspicious_cogs_entries,
  CASE WHEN (SELECT count(*) FROM cogs_ledger) > 0 THEN true ELSE false END AS has_cogs_data,
  CASE WHEN (SELECT count(*) FROM batch_cost_history) > 0 THEN true ELSE false END AS has_batch_costs,
  CASE WHEN (SELECT count(*) FROM worker_payouts) > 0 THEN true ELSE false END AS has_labor_data;
