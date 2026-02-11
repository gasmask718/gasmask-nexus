
-- Phase 2B: Unit Canonicalization — Corrected for Actual Schema
-- Drop previous attempts
DROP VIEW IF EXISTS v_invoice_line_units CASCADE;
DROP VIEW IF EXISTS v_inventory_movements_with_repairs CASCADE;
DROP VIEW IF EXISTS v_tube_reorder_alerts CASCADE;
DROP VIEW IF EXISTS v_bag_reorder_alerts CASCADE;
DROP VIEW IF EXISTS v_tube_bag_ratio_per_store CASCADE;
DROP VIEW IF EXISTS v_inventory_movements CASCADE;

-- 1. Add canonical generated column
ALTER TABLE invoice_line_items
ADD COLUMN IF NOT EXISTS computed_units_total numeric
GENERATED ALWAYS AS (computed_tubes_total) STORED;

-- 2. Unified inventory movements abstraction
CREATE VIEW v_inventory_movements AS
SELECT
  store_id,
  product_id,
  'tubes' AS track_by,
  tubes_delta AS units_delta,
  'tube_sale' AS source,
  created_at
FROM tube_sale_ledger
UNION ALL
SELECT
  store_id,
  product_id,
  'bags' AS track_by,
  bags_delta AS units_delta,
  'bag_sale' AS source,
  created_at
FROM bag_sale_ledger
UNION ALL
SELECT
  store_id,
  product_id,
  track_by,
  units_delta,
  'repair' AS source,
  created_at
FROM inventory_repair_ledger;

-- 3. Unit label helper view
CREATE VIEW v_invoice_line_units AS
SELECT
  ili.*,
  p.track_by,
  CASE
    WHEN p.track_by = 'tubes' THEN 'tubes'
    WHEN p.track_by = 'bags' THEN 'bags'
    ELSE 'units'
  END AS unit_label
FROM invoice_line_items ili
JOIN products p ON p.id = ili.product_id;

-- 4. Reorder alerts for tubes (based on ledger aggregation)
CREATE VIEW v_tube_reorder_alerts AS
SELECT
  m.store_id,
  m.product_id,
  p.name AS product_name,
  COALESCE(SUM(m.units_delta), 0) AS tubes_on_hand,
  COALESCE(rp.min_reorder_qty, 0) AS min_quantity,
  COALESCE(rp.max_reorder_qty, 0) AS reorder_quantity,
  CASE
    WHEN COALESCE(SUM(m.units_delta), 0) <= COALESCE(rp.min_reorder_qty, 0) THEN 'critical'
    ELSE 'warning'
  END AS alert_level
FROM v_inventory_movements m
LEFT JOIN products p ON p.id = m.product_id
LEFT JOIN reorder_policies rp ON rp.product_id = m.product_id
WHERE m.track_by = 'tubes'
GROUP BY m.store_id, m.product_id, p.name, rp.min_reorder_qty, rp.max_reorder_qty
HAVING COALESCE(SUM(m.units_delta), 0) < COALESCE(rp.max_reorder_qty, 0);

-- 5. Reorder alerts for bags
CREATE VIEW v_bag_reorder_alerts AS
SELECT
  m.store_id,
  m.product_id,
  p.name AS product_name,
  COALESCE(SUM(m.units_delta), 0) AS bags_on_hand,
  COALESCE(rp.min_reorder_qty, 0) AS min_quantity,
  COALESCE(rp.max_reorder_qty, 0) AS reorder_quantity,
  CASE
    WHEN COALESCE(SUM(m.units_delta), 0) <= COALESCE(rp.min_reorder_qty, 0) THEN 'critical'
    ELSE 'warning'
  END AS alert_level
FROM v_inventory_movements m
LEFT JOIN products p ON p.id = m.product_id
LEFT JOIN reorder_policies rp ON rp.product_id = m.product_id
WHERE m.track_by = 'bags'
GROUP BY m.store_id, m.product_id, p.name, rp.min_reorder_qty, rp.max_reorder_qty
HAVING COALESCE(SUM(m.units_delta), 0) < COALESCE(rp.max_reorder_qty, 0);

-- 6. Tube/bag ratio analytics per store
CREATE VIEW v_tube_bag_ratio_per_store AS
SELECT
  m.store_id,
  COALESCE(
    (SELECT SUM(units_delta) FROM v_inventory_movements 
     WHERE track_by = 'tubes' AND store_id = m.store_id), 0
  ) AS total_tubes_sold,
  COALESCE(
    (SELECT SUM(units_delta) FROM v_inventory_movements 
     WHERE track_by = 'bags' AND store_id = m.store_id), 0
  ) AS total_bags_sold,
  CASE
    WHEN (SELECT SUM(units_delta) FROM v_inventory_movements 
          WHERE track_by = 'tubes' AND store_id = m.store_id) = 0 THEN 0
    ELSE ROUND(
      ((SELECT SUM(units_delta) FROM v_inventory_movements 
        WHERE track_by = 'bags' AND store_id = m.store_id)::numeric / 
       (SELECT SUM(units_delta) FROM v_inventory_movements 
        WHERE track_by = 'tubes' AND store_id = m.store_id)) * 100, 2
    )
  END AS bags_to_tubes_ratio_percent
FROM v_inventory_movements m
GROUP BY m.store_id;

-- 7. Documentation
COMMENT ON COLUMN invoice_line_items.computed_tubes_total IS
'Canonical unit count. Legacy name preserved for compatibility. Math is unit-agnostic.';

COMMENT ON COLUMN invoice_line_items.computed_units_total IS
'Semantic alias for computed_tubes_total. Use in new logic.';

COMMENT ON VIEW v_invoice_line_units IS
'Invoice line items with product unit labels for UI display.';

COMMENT ON VIEW v_inventory_movements IS
'Unified abstraction of all inventory sources (tubes, bags, repairs).';

COMMENT ON VIEW v_tube_reorder_alerts IS
'Reorder alerts for tube products from ledger aggregation.';

COMMENT ON VIEW v_bag_reorder_alerts IS
'Reorder alerts for bag products from ledger aggregation.';

COMMENT ON VIEW v_tube_bag_ratio_per_store IS
'Store-level ratio analytics for shrinkage/mix analysis.';
