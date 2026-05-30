CREATE OR REPLACE VIEW public.v_invoice_line_margin AS
SELECT
  li.invoice_id,
  li.id AS line_item_id,
  li.product_id,
  li.product_name,
  inv.store_id,
  li.brand_id,
  li.brand,
  li.line_subtotal AS revenue,
  COALESCE(cogs.total_cogs, li.cost_per_unit_at_sale * li.quantity, 0::numeric) AS cogs,
  li.line_subtotal - COALESCE(cogs.total_cogs, li.cost_per_unit_at_sale * li.quantity, 0::numeric) AS gross_profit,
  CASE
    WHEN li.line_subtotal > 0::numeric
      THEN round((li.line_subtotal - COALESCE(cogs.total_cogs, li.cost_per_unit_at_sale * li.quantity, 0::numeric)) / li.line_subtotal, 4)
    ELSE 0::numeric
  END AS margin_pct
FROM invoice_line_items li
JOIN invoices inv ON inv.id = li.invoice_id
LEFT JOIN (
  SELECT line_item_id, sum(total_cost) AS total_cogs
  FROM cogs_ledger
  GROUP BY line_item_id
) cogs ON cogs.line_item_id = li.id
WHERE inv.status = 'finalized'::text;

CREATE OR REPLACE VIEW public.v_negative_margin_alerts AS
SELECT
  invoice_id,
  line_item_id,
  product_id,
  product_name,
  store_id,
  brand,
  revenue,
  cogs,
  gross_profit,
  margin_pct,
  CASE
    WHEN margin_pct < 0::numeric THEN 'negative_margin'::text
    WHEN margin_pct < 0.10 THEN 'thin_margin'::text
    WHEN cogs = 0::numeric AND revenue > 0::numeric THEN 'unknown_cost'::text
    ELSE 'healthy'::text
  END AS alert_type
FROM v_invoice_line_margin
WHERE margin_pct < 0.10 OR (cogs = 0::numeric AND revenue > 0::numeric);