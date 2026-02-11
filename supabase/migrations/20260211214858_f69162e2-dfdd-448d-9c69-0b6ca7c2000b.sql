
-- Phase 2B: Unit Canonicalization + Future-Proof Naming
-- Safe approach: drop dependent views first, then recreate with canonical logic

-- ============================================================================
-- 1. ADD CANONICAL GENERATED COLUMN
-- ============================================================================
ALTER TABLE invoice_line_items
ADD COLUMN IF NOT EXISTS computed_units_total numeric
GENERATED ALWAYS AS (computed_tubes_total) STORED;

-- ============================================================================
-- 2. DROP EXISTING DEPENDENT VIEWS (safe to recreate)
-- ============================================================================
DROP VIEW IF EXISTS v_tubes_sold_finalized CASCADE;
DROP VIEW IF EXISTS v_bags_sold_finalized CASCADE;
DROP VIEW IF EXISTS v_store_tubes_on_hand CASCADE;
DROP VIEW IF EXISTS v_store_bags_on_hand CASCADE;
DROP VIEW IF EXISTS v_inventory_movements_with_repairs CASCADE;
DROP VIEW IF EXISTS v_inventory_movements CASCADE;
DROP VIEW IF EXISTS v_invoice_line_units CASCADE;

-- ============================================================================
-- 3. UNIT LABEL HELPER VIEW
-- ============================================================================
CREATE VIEW v_invoice_line_units AS
SELECT
  ili.id,
  ili.invoice_id,
  ili.product_id,
  ili.quantity_boxes,
  ili.quantity_tubes,
  ili.units_per_box_snapshot,
  ili.computed_tubes_total,
  ili.computed_units_total,
  ili.list_unit_price,
  ili.unit_price_used,
  ili.discount_type,
  ili.discount_value,
  ili.discount_reason,
  ili.price_override_reason,
  ili.sale_unit,
  ili.created_at,
  p.track_by,
  CASE
    WHEN p.track_by = 'tubes' THEN 'tubes'
    WHEN p.track_by = 'bags' THEN 'bags'
    ELSE 'units'
  END AS unit_label
FROM invoice_line_items ili
JOIN products p ON p.id = ili.product_id;

COMMENT ON VIEW v_invoice_line_units IS
'Canonical invoice line item view with unit labels. Removes UI guesswork about what a "unit" means for each product.';

-- ============================================================================
-- 4. UNIFIED LEDGER ABSTRACTION VIEW
-- ============================================================================
CREATE VIEW v_inventory_movements AS
SELECT
  tsl.id,
  tsl.invoice_id,
  tsl.store_id,
  tsl.product_id,
  'tubes' AS track_by,
  tsl.tubes_delta AS units_delta,
  tsl.source,
  tsl.recorded_by,
  tsl.created_at
FROM tube_sale_ledger tsl
UNION ALL
SELECT
  bsl.id,
  bsl.invoice_id,
  bsl.store_id,
  bsl.product_id,
  'bags' AS track_by,
  bsl.bags_delta AS units_delta,
  bsl.source,
  bsl.recorded_by,
  bsl.created_at
FROM bag_sale_ledger bsl;

COMMENT ON VIEW v_inventory_movements IS
'Unified inventory movements across all product types. Ledger deltas represent final sellable units. Product.track_by determines semantic meaning. Supports future product types without schema changes.';

-- ============================================================================
-- 5. REPAIR LEDGER ABSTRACTION
-- ============================================================================
CREATE VIEW v_inventory_movements_with_repairs AS
SELECT
  id,
  invoice_id,
  store_id,
  product_id,
  track_by,
  units_delta,
  source,
  recorded_by,
  created_at
FROM v_inventory_movements
UNION ALL
SELECT
  irl.id,
  irl.invoice_id,
  irl.store_id,
  irl.product_id,
  irl.track_by,
  irl.units_delta,
  irl.source,
  irl.repaired_by AS recorded_by,
  irl.created_at
FROM inventory_repair_ledger irl;

COMMENT ON VIEW v_inventory_movements_with_repairs IS
'Complete inventory movement history including repairs. Used for NET inventory calculations.';

-- ============================================================================
-- 6. NET INVENTORY VIEWS USING CANONICAL ABSTRACTION
-- ============================================================================
CREATE VIEW v_store_tubes_on_hand AS
SELECT
  imr.store_id,
  imr.product_id,
  p.name AS product_name,
  p.track_by,
  -SUM(imr.units_delta) FILTER (WHERE imr.track_by = 'tubes') AS tubes_on_hand
FROM v_inventory_movements_with_repairs imr
LEFT JOIN products p ON p.id = imr.product_id
WHERE imr.track_by = 'tubes'
GROUP BY imr.store_id, imr.product_id, p.name, p.track_by;

COMMENT ON VIEW v_store_tubes_on_hand IS
'NET tube inventory on hand by store. Includes finalized invoices, voids, and repairs.';

CREATE VIEW v_store_bags_on_hand AS
SELECT
  imr.store_id,
  imr.product_id,
  p.name AS product_name,
  p.track_by,
  -SUM(imr.units_delta) FILTER (WHERE imr.track_by = 'bags') AS bags_on_hand
FROM v_inventory_movements_with_repairs imr
LEFT JOIN products p ON p.id = imr.product_id
WHERE imr.track_by = 'bags'
GROUP BY imr.store_id, imr.product_id, p.name, p.track_by;

COMMENT ON VIEW v_store_bags_on_hand IS
'NET bag inventory on hand by store. Includes finalized invoices, voids, and repairs.';

-- ============================================================================
-- 7. SOLD VIEWS (FINALIZED ONLY)
-- ============================================================================
CREATE VIEW v_tubes_sold_finalized AS
SELECT
  vm.store_id,
  vm.product_id,
  p.name AS product_name,
  SUM(ABS(vm.units_delta)) AS tubes_sold
FROM v_inventory_movements vm
LEFT JOIN products p ON p.id = vm.product_id
WHERE vm.track_by = 'tubes' AND vm.source = 'invoice_finalized'
GROUP BY vm.store_id, vm.product_id, p.name;

COMMENT ON VIEW v_tubes_sold_finalized IS
'SOLD analytics: finalized tubes only (excludes repairs). Used for clean sales reporting.';

CREATE VIEW v_bags_sold_finalized AS
SELECT
  vm.store_id,
  vm.product_id,
  p.name AS product_name,
  SUM(ABS(vm.units_delta)) AS bags_sold
FROM v_inventory_movements vm
LEFT JOIN products p ON p.id = vm.product_id
WHERE vm.track_by = 'bags' AND vm.source = 'invoice_finalized'
GROUP BY vm.store_id, vm.product_id, p.name;

COMMENT ON VIEW v_bags_sold_finalized IS
'SOLD analytics: finalized bags only (excludes repairs). Used for clean sales reporting.';

-- ============================================================================
-- 8. SCHEMA DOCUMENTATION FOR DEVELOPERS
-- ============================================================================
COMMENT ON COLUMN invoice_line_items.computed_tubes_total IS
'Canonical unit count. Name preserved for legacy compatibility. Use computed_units_total in new code. Represents final sellable units determined by product.track_by.';

COMMENT ON COLUMN invoice_line_items.computed_units_total IS
'Forward-compatible alias for computed_tubes_total. Represents final sellable units for any tracked product type. Preferred in new code.';

COMMENT ON TABLE tube_sale_ledger IS
'Immutable ledger. Never UPDATE/DELETE. For corrections, use inventory_repair_ledger.';

COMMENT ON TABLE bag_sale_ledger IS
'Immutable ledger. Never UPDATE/DELETE. For corrections, use inventory_repair_ledger.';

COMMENT ON TABLE inventory_repair_ledger IS
'Append-only repair ledger. Tracks unit corrections without mutating original ledgers.';
