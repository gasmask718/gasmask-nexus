
-- Fix: store_master uses store_name not name
-- Ambassador Profit Breakdown View
CREATE OR REPLACE VIEW public.v_ambassador_profit_breakdown AS
SELECT
  asp.ambassador_id,
  asp.ambassador_user_id,
  ili.brand,
  ili.brand_id,
  ili.product_name,
  ili.product_id,
  ili.sale_channel,
  i.store_id,
  sm.store_name,
  SUM(ili.quantity) AS units_sold,
  SUM(ili.cost_per_unit_at_sale * ili.quantity) AS wholesale_cost,
  SUM(ili.total) AS retail_revenue,
  SUM(ili.profit_at_sale) AS net_profit,
  ROUND(
    CASE 
      WHEN COALESCE(SUM(ili.total), 0) > 0 
      THEN (COALESCE(SUM(ili.profit_at_sale), 0) / SUM(ili.total)) * 100
      ELSE 0
    END, 2
  ) AS margin_pct,
  MIN(i.created_at) AS first_sale_at,
  MAX(i.created_at) AS last_sale_at,
  DATE_TRUNC('month', i.created_at) AS sale_month
FROM ambassador_store_portfolio asp
JOIN invoices i ON i.store_id = asp.store_id
JOIN invoice_line_items ili ON ili.invoice_id = i.id
LEFT JOIN store_master sm ON sm.id = i.store_id
WHERE asp.active = true
GROUP BY 
  asp.ambassador_id, asp.ambassador_user_id,
  ili.brand, ili.brand_id, ili.product_name, ili.product_id,
  ili.sale_channel, i.store_id, sm.store_name,
  DATE_TRUNC('month', i.created_at);
