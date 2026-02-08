
-- =============================================
-- Store Sell-Through Intelligence Views
-- Source of truth: invoices table (1329 records)
-- Falls back to invoice_line_items when populated
-- =============================================

-- 1) v_store_brand_order_events
-- One row per order event per store per brand
CREATE OR REPLACE VIEW public.v_store_brand_order_events AS
SELECT
  i.id AS order_id,
  i.store_id,
  i.brand AS brand_name,
  i.created_at AS order_date,
  COALESCE(
    (SELECT SUM(ili.quantity) FROM invoice_line_items ili WHERE ili.invoice_id = i.id),
    0
  )::int AS total_units,
  COALESCE(
    (SELECT SUM(ili.tubes_equivalent) FROM invoice_line_items ili WHERE ili.invoice_id = i.id),
    0
  )::numeric AS total_tubes,
  COALESCE(i.total_amount, i.total, i.subtotal, 0)::numeric AS total_amount,
  i.payment_status,
  i.created_by AS order_source
FROM invoices i
WHERE i.store_id IS NOT NULL
  AND i.brand IS NOT NULL;

-- 2) v_store_brand_order_gaps
-- Computes time between orders using window functions
CREATE OR REPLACE VIEW public.v_store_brand_order_gaps AS
SELECT
  e.order_id,
  e.store_id,
  e.brand_name,
  e.order_date,
  e.total_units,
  e.total_tubes,
  e.total_amount,
  e.payment_status,
  LAG(e.order_date) OVER (
    PARTITION BY e.store_id, e.brand_name
    ORDER BY e.order_date
  ) AS previous_order_date,
  EXTRACT(DAY FROM
    e.order_date - LAG(e.order_date) OVER (
      PARTITION BY e.store_id, e.brand_name
      ORDER BY e.order_date
    )
  )::int AS days_between_orders,
  ROW_NUMBER() OVER (
    PARTITION BY e.store_id, e.brand_name
    ORDER BY e.order_date DESC
  ) AS recency_rank
FROM v_store_brand_order_events e;

-- 3) v_store_brand_sell_through_summary
-- Summary KPIs per store + brand
CREATE OR REPLACE VIEW public.v_store_brand_sell_through_summary AS
WITH order_gaps AS (
  SELECT
    store_id,
    brand_name,
    days_between_orders
  FROM v_store_brand_order_gaps
  WHERE days_between_orders IS NOT NULL
    AND days_between_orders > 0
),
gap_stats AS (
  SELECT
    store_id,
    brand_name,
    AVG(days_between_orders)::numeric(10,1) AS avg_days_between_orders,
    MIN(days_between_orders) AS min_days_between,
    MAX(days_between_orders) AS max_days_between
  FROM order_gaps
  GROUP BY store_id, brand_name
),
order_stats AS (
  SELECT
    e.store_id,
    e.brand_name,
    COUNT(*) AS total_orders_lifetime,
    SUM(e.total_units) AS total_units_lifetime,
    SUM(e.total_tubes) AS total_tubes_lifetime,
    SUM(e.total_amount) AS total_revenue_lifetime,
    MAX(e.order_date) AS last_order_date,
    MIN(e.order_date) AS first_order_date,
    COUNT(*) FILTER (WHERE e.order_date >= NOW() - INTERVAL '30 days') AS orders_last_30d,
    COUNT(*) FILTER (WHERE e.order_date >= NOW() - INTERVAL '90 days') AS orders_last_90d,
    SUM(e.total_amount) FILTER (WHERE e.order_date >= NOW() - INTERVAL '30 days') AS revenue_last_30d,
    SUM(e.total_amount) FILTER (WHERE e.order_date >= NOW() - INTERVAL '90 days') AS revenue_last_90d
  FROM v_store_brand_order_events e
  GROUP BY e.store_id, e.brand_name
)
SELECT
  os.store_id,
  os.brand_name,
  os.total_orders_lifetime,
  os.total_units_lifetime,
  os.total_tubes_lifetime,
  os.total_revenue_lifetime,
  os.first_order_date,
  os.last_order_date,
  EXTRACT(DAY FROM NOW() - os.last_order_date)::int AS days_since_last_order,
  gs.avg_days_between_orders,
  gs.min_days_between,
  gs.max_days_between,
  os.orders_last_30d,
  os.orders_last_90d,
  os.revenue_last_30d,
  os.revenue_last_90d,
  -- Velocity: revenue per day since first order
  CASE
    WHEN os.first_order_date = os.last_order_date THEN NULL
    ELSE (os.total_revenue_lifetime / NULLIF(EXTRACT(DAY FROM os.last_order_date - os.first_order_date), 0))::numeric(10,2)
  END AS revenue_per_day,
  -- Frequency classification
  CASE
    WHEN gs.avg_days_between_orders IS NULL THEN 'New'
    WHEN gs.avg_days_between_orders <= 14 THEN 'Fast'
    WHEN gs.avg_days_between_orders <= 30 THEN 'Medium'
    ELSE 'Slow'
  END AS order_frequency_class,
  -- Projected next order date
  CASE
    WHEN gs.avg_days_between_orders IS NOT NULL
    THEN os.last_order_date + (gs.avg_days_between_orders || ' days')::interval
    ELSE NULL
  END AS projected_next_order
FROM order_stats os
LEFT JOIN gap_stats gs ON gs.store_id = os.store_id AND gs.brand_name = os.brand_name;
