-- ============================================================
-- Fix v_ambassador_profit_breakdown fan-out bug.
-- Cause: overlapping rows in ambassador_assignments multiplied
-- every invoice_line_item by the count of matching assignments.
-- Fix: dedupe with DISTINCT ON so each (ambassador, invoice) pair
-- is attributed to exactly one assignment (earliest active).
-- ============================================================

DROP VIEW IF EXISTS public.v_ambassador_profit_dashboard CASCADE;
DROP VIEW IF EXISTS public.v_ambassador_profit_breakdown CASCADE;

CREATE VIEW public.v_ambassador_profit_breakdown AS
WITH invoice_attribution AS (
  -- One assignment row per (ambassador, invoice) — earliest active match wins
  SELECT DISTINCT ON (aa.ambassador_id, i.id)
    aa.ambassador_id,
    a.user_id              AS ambassador_user_id,
    i.id                   AS invoice_id,
    i.store_id,
    i.created_at           AS invoice_created_at,
    aa.start_date,
    aa.end_date,
    aa.unassigned_at,
    aa.created_at          AS assignment_created_at
  FROM ambassador_assignments aa
  JOIN ambassadors a ON a.id = aa.ambassador_id
  JOIN invoices    i ON i.store_id = aa.store_id
                   AND i.created_at >= COALESCE(aa.start_date::timestamptz, aa.created_at)
                   AND i.created_at <= COALESCE(aa.unassigned_at, aa.end_date::timestamptz + interval '1 day', now())
  WHERE aa.store_id IS NOT NULL
  ORDER BY aa.ambassador_id, i.id, aa.created_at ASC
)
SELECT
  at.ambassador_id,
  at.ambassador_user_id,
  ili.brand,
  ili.brand_id,
  ili.product_name,
  ili.product_id,
  ili.sale_channel,
  at.store_id,
  sm.store_name,
  SUM(ili.quantity)                                                  AS units_sold,
  SUM(ili.cost_per_unit_at_sale * ili.quantity::numeric)             AS wholesale_cost,
  SUM(ili.total)                                                     AS retail_revenue,
  SUM(ili.profit_at_sale)                                            AS net_profit,
  ROUND(
    CASE
      WHEN COALESCE(SUM(ili.total), 0) > 0
      THEN (COALESCE(SUM(ili.profit_at_sale), 0) / SUM(ili.total)) * 100
      ELSE 0
    END, 2
  )                                                                  AS margin_pct,
  MIN(at.invoice_created_at)                                         AS first_sale_at,
  MAX(at.invoice_created_at)                                         AS last_sale_at,
  date_trunc('month', at.invoice_created_at)                         AS sale_month,
  'windowed_assignment'::text                                        AS attribution_method,
  TRUE                                                               AS attribution_valid,
  CASE
    WHEN BOOL_AND(ili.cost_per_unit_at_sale IS NOT NULL AND ili.cost_per_unit_at_sale > 0) THEN 100
    ELSE 50
  END                                                                AS profit_confidence_score,
  CASE
    WHEN BOOL_AND(ili.cost_per_unit_at_sale IS NOT NULL AND ili.cost_per_unit_at_sale > 0) THEN 'confirmed'::text
    ELSE 'estimated'::text
  END                                                                AS profit_status
FROM invoice_attribution at
JOIN invoice_line_items ili ON ili.invoice_id = at.invoice_id
LEFT JOIN store_master sm   ON sm.id = at.store_id
GROUP BY
  at.ambassador_id, at.ambassador_user_id,
  ili.brand, ili.brand_id, ili.product_name, ili.product_id, ili.sale_channel,
  at.store_id, sm.store_name,
  date_trunc('month', at.invoice_created_at);

GRANT SELECT ON public.v_ambassador_profit_breakdown TO authenticated, service_role;

CREATE VIEW public.v_ambassador_profit_dashboard AS
SELECT
  b.ambassador_id,
  b.ambassador_user_id,
  p.name AS ambassador_name,
  COUNT(DISTINCT b.sale_month)                              AS total_invoices,
  COALESCE(SUM(b.units_sold), 0)                            AS total_units_sold,
  COALESCE(SUM(b.retail_revenue), 0)                        AS total_revenue,
  COALESCE(SUM(b.wholesale_cost), 0)                        AS total_wholesale_cost,
  COALESCE(SUM(b.net_profit), 0)                            AS total_profit,
  ROUND(
    CASE
      WHEN COALESCE(SUM(b.retail_revenue), 0) > 0
      THEN (COALESCE(SUM(b.net_profit), 0) / SUM(b.retail_revenue)) * 100
      ELSE 0
    END, 2
  )                                                         AS avg_margin_pct,
  COUNT(DISTINCT b.brand)                                   AS brands_sold,
  COUNT(DISTINCT b.product_name)                            AS products_sold,
  COUNT(DISTINCT b.store_id)                                AS stores_served,
  ROUND(AVG(b.profit_confidence_score), 0)                  AS avg_confidence_score,
  COUNT(*) FILTER (WHERE b.profit_status = 'estimated')     AS estimated_row_count,
  COUNT(*) FILTER (WHERE b.profit_status = 'confirmed')     AS confirmed_row_count
FROM public.v_ambassador_profit_breakdown b
LEFT JOIN profiles p ON p.id = b.ambassador_user_id
GROUP BY b.ambassador_id, b.ambassador_user_id, p.name;

GRANT SELECT ON public.v_ambassador_profit_dashboard TO authenticated, service_role;
