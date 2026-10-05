CREATE OR REPLACE VIEW public.v_store_last_order_snapshot AS
WITH lines AS (
  SELECT li.invoice_id,
    (li.product_id = '170adb8f-ac4e-40f4-a283-38730d30c5de'::uuid OR lower(coalesce(li.product_name,'')) LIKE '%bag%') AS is_bag,
    CASE
      WHEN li.computed_units_total IS NOT NULL AND li.computed_units_total > 0 THEN li.computed_units_total
      WHEN li.tubes_equivalent IS NOT NULL AND li.tubes_equivalent > 0 THEN li.tubes_equivalent
      WHEN lower(li.unit_type) = 'box' THEN li.quantity * COALESCE(li.units_per_box_snapshot, 100)::numeric
      WHEN lower(li.unit_type) = 'half_box' THEN li.quantity * 50::numeric
      ELSE li.quantity
    END AS units
  FROM invoice_line_items li
  WHERE li.deleted_at IS NULL
), inv_family AS (
  SELECT i.id AS invoice_id, i.store_id,
    CASE WHEN l.is_bag THEN trim(i.brand) || ' Bags' ELSE trim(i.brand) END AS brand,
    COALESCE(i.business_date::timestamptz, i.created_at) AS order_date,
    max(i.total_amount) AS inv_total,
    COALESCE(sum(l.units),0) AS total_units,
    count(l.*) AS line_count
  FROM invoices i
  LEFT JOIN lines l ON l.invoice_id = i.id
  WHERE i.deleted_at IS NULL AND i.store_id IS NOT NULL AND i.brand IS NOT NULL AND trim(i.brand) <> ''
  GROUP BY i.id, i.store_id, i.brand, i.business_date, i.created_at, l.is_bag
), fam AS (
  SELECT invoice_id, store_id, brand, lower(brand) AS brand_key, order_date, inv_total AS total_amount, total_units, line_count,
    row_number() OVER (PARTITION BY store_id, lower(brand) ORDER BY order_date DESC) AS rn
  FROM inv_family
), agg AS (
  SELECT store_id, brand_key, count(DISTINCT invoice_id) AS total_order_count,
    avg(total_units) FILTER (WHERE line_count > 0) AS avg_units,
    CASE WHEN count(DISTINCT invoice_id) >= 2
      THEN EXTRACT(epoch FROM max(order_date) - min(order_date)) / 86400.0 / GREATEST(count(DISTINCT invoice_id) - 1, 1)::numeric
      ELSE NULL::numeric END AS avg_days
  FROM fam GROUP BY store_id, brand_key
)
SELECT f.store_id,
  sm.store_name,
  f.brand AS brand_name,
  f.brand_key,
  f.order_date AS last_order_date,
  EXTRACT(day FROM now() - f.order_date)::integer AS days_since_last_order,
  f.total_units::integer AS last_order_total_units,
  round(f.total_units / 100.0, 2) AS last_order_box_equivalent,
  CASE
    WHEN f.line_count = 0 THEN 'No items recorded'
    WHEN f.brand_key LIKE '% bags' THEN
      CASE WHEN f.total_units >= 100 AND mod(f.total_units::integer, 100) = 0
        THEN (f.total_units::integer / 100)::text || ' Box' || CASE WHEN f.total_units::integer > 100 THEN 'es' ELSE '' END || ' (' || f.total_units::integer::text || ' Bags)'
        ELSE f.total_units::integer::text || ' Bags' END
    WHEN f.total_units >= 100 AND mod(f.total_units::integer, 100) = 0
      THEN (f.total_units::integer / 100)::text || ' Full Box' || CASE WHEN f.total_units::integer > 100 THEN 'es' ELSE '' END
    WHEN f.total_units = 50 THEN 'Half Box'
    ELSE f.total_units::integer::text || ' Tubes'
  END AS last_order_size_label,
  f.total_amount AS last_order_total_amount,
  f.line_count AS last_order_line_count,
  a.total_order_count,
  round(COALESCE(a.avg_units, 0))::integer AS avg_tubes_per_order,
  round(COALESCE(a.avg_days, 0))::integer AS avg_days_between_orders,
  (a.avg_days IS NOT NULL AND EXTRACT(day FROM now() - f.order_date) > a.avg_days * 1.5) AS is_restock_due,
  (a.avg_units IS NOT NULL AND a.avg_units > 0 AND f.line_count > 0 AND f.total_units < a.avg_units * 0.7) AS is_order_smaller_than_usual
FROM fam f
LEFT JOIN store_master sm ON sm.id = f.store_id
LEFT JOIN agg a ON a.store_id = f.store_id AND a.brand_key = f.brand_key
WHERE f.rn = 1;