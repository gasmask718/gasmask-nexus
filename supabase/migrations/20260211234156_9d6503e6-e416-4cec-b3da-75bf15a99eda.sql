
-- Step 1: Drop views that depend on the generated column
DROP VIEW IF EXISTS v_invoice_line_units CASCADE;

-- Step 2: Drop and recreate computed_units_total as a regular (writable) column
ALTER TABLE invoice_line_items
DROP COLUMN computed_units_total CASCADE;

ALTER TABLE invoice_line_items
ADD COLUMN computed_units_total numeric;

-- Step 3: Backfill from legacy column
UPDATE invoice_line_items
SET computed_units_total = computed_tubes_total
WHERE computed_units_total IS NULL;

-- Step 4: Create the sync trigger for bidirectional updates
CREATE OR REPLACE FUNCTION sync_computed_units()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.computed_units_total := COALESCE(NEW.computed_units_total, NEW.computed_tubes_total);
  NEW.computed_tubes_total := NEW.computed_units_total;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_units ON invoice_line_items;

CREATE TRIGGER trg_sync_units
BEFORE INSERT OR UPDATE ON invoice_line_items
FOR EACH ROW
EXECUTE FUNCTION sync_computed_units();

-- Step 5: Recreate the view
CREATE OR REPLACE VIEW v_invoice_line_units AS
SELECT
  ili.id,
  ili.created_at,
  ili.invoice_id,
  ili.product_name,
  ili.brand,
  ili.quantity,
  ili.unit_price,
  ili.total,
  ili.brand_id,
  ili.product_id,
  ili.unit_type,
  ili.tubes_equivalent,
  ili.sale_channel,
  ili.sale_unit,
  ili.cost_per_unit_at_sale,
  ili.profit_at_sale,
  ili.units_per_box_snapshot,
  ili.tubes_per_unit,
  ili.quantity_boxes,
  ili.quantity_tubes,
  ili.computed_tubes_total,
  ili.product_name_snapshot,
  ili.brand_name_snapshot,
  ili.list_unit_price,
  ili.unit_price_used,
  ili.discount_type,
  ili.discount_value,
  ili.discount_reason,
  ili.price_override_reason,
  ili.line_subtotal,
  ili.computed_units_total
FROM invoice_line_items ili;

-- Step 6: Add feature flag
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS use_canonical_units boolean DEFAULT false;

-- Step 7: Deprecation comment
COMMENT ON COLUMN invoice_line_items.computed_tubes_total IS
'DEPRECATED: Legacy alias. Use computed_units_total. Removal planned post Phase 4.';
