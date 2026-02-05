-- ═══════════════════════════════════════════════════════════════════════════════
-- v_store_tube_kpi: Unified Store Tube Intelligence + Order History View
-- Returns ONE row per store_id + brand_id with:
--   - tube_count (from store_tube_inventory)
--   - last_order_date (from invoices + invoice_line_items)
--   - last_order_label ('Never ordered' or formatted date)
--   - color_status (green/yellow/red/muted based on legacy logic)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.v_store_tube_kpi AS
WITH 
-- Get tube counts from store_tube_inventory (aggregated per store+brand)
tube_counts AS (
  SELECT 
    sti.store_id,
    LOWER(sti.brand) AS brand_id,
    sti.brand AS brand_name,
    COALESCE(sti.current_tubes_left, 0) AS tube_count,
    sti.last_updated
  FROM store_tube_inventory sti
  WHERE sti.brand IS NOT NULL
),

-- Get tube intelligence status (for operational signals)
intel_status AS (
  SELECT
    stis.store_id,
    stis.brand_id,
    stis.brand_name,
    stis.needs_order,
    stis.bring_samples,
    stis.bring_starter_kit,
    stis.owner_interested,
    stis.has_ever_ordered,
    stis.is_simulation
  FROM store_tube_inventory_status stis
  WHERE stis.is_simulation = false
),

-- Get last order date per store+brand from invoices (paid/completed orders)
last_orders AS (
  SELECT 
    i.store_id,
    LOWER(ili.brand) AS brand_id,
    MAX(i.created_at) AS last_order_date
  FROM invoices i
  INNER JOIN invoice_line_items ili ON ili.invoice_id = i.id
  WHERE i.payment_status IN ('paid', 'partial')
    AND ili.brand IS NOT NULL
    AND i.store_id IS NOT NULL
  GROUP BY i.store_id, LOWER(ili.brand)
),

-- Get all unique store+brand combinations from both sources
all_store_brands AS (
  SELECT store_id, brand_id FROM tube_counts
  UNION
  SELECT store_id, brand_id FROM intel_status
  UNION
  SELECT store_id, brand_id FROM last_orders
)

SELECT 
  asb.store_id,
  asb.brand_id,
  COALESCE(tc.brand_name, ist.brand_name, INITCAP(asb.brand_id)) AS brand_name,
  COALESCE(tc.tube_count, 0) AS tube_count,
  lo.last_order_date,
  CASE 
    WHEN lo.last_order_date IS NULL THEN 'Never ordered'
    ELSE TO_CHAR(lo.last_order_date::timestamp, 'Mon DD, YYYY')
  END AS last_order_label,
  -- Color flow logic:
  -- 🟢 Green: tubes > 0 AND has ordered before
  -- 🟡 Yellow: tubes > 0 AND never ordered
  -- 🔴 Red: tubes = 0
  -- ⚪ Muted: product exists but no data
  CASE 
    WHEN COALESCE(tc.tube_count, 0) = 0 THEN 'red'
    WHEN lo.last_order_date IS NOT NULL THEN 'green'
    WHEN lo.last_order_date IS NULL AND COALESCE(tc.tube_count, 0) > 0 THEN 'yellow'
    ELSE 'muted'
  END AS color_status,
  -- Operational signals from intel
  COALESCE(ist.needs_order, false) AS needs_order,
  COALESCE(ist.bring_samples, false) AS bring_samples,
  COALESCE(ist.bring_starter_kit, false) AS bring_starter_kit,
  ist.owner_interested,
  tc.last_updated AS inventory_updated_at
FROM all_store_brands asb
LEFT JOIN tube_counts tc 
  ON tc.store_id = asb.store_id AND tc.brand_id = asb.brand_id
LEFT JOIN intel_status ist 
  ON ist.store_id = asb.store_id AND ist.brand_id = asb.brand_id
LEFT JOIN last_orders lo 
  ON lo.store_id = asb.store_id AND lo.brand_id = asb.brand_id;

-- Grant access to authenticated users
GRANT SELECT ON public.v_store_tube_kpi TO authenticated;
GRANT SELECT ON public.v_store_tube_kpi TO anon;

COMMENT ON VIEW public.v_store_tube_kpi IS 'Unified Store Tube KPI view: tube counts + last order dates per brand with color flow status';