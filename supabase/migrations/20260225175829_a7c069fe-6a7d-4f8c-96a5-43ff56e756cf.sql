
-- =====================================================
-- PRODUCT-AWARE BOX CONVERSION ENGINE
-- Two-layer model: lbs → product_output_units → boxes (100 units = 1 box)
-- =====================================================

-- 1. Add new snapshot columns
ALTER TABLE production_batches 
  ADD COLUMN IF NOT EXISTS conversion_boxes_per_lb_snapshot numeric,
  ADD COLUMN IF NOT EXISTS time_per_box_snapshot numeric;

-- 2. Add baseline_time_per_box to baseline table
ALTER TABLE production_conversion_baseline
  ADD COLUMN IF NOT EXISTS baseline_time_per_box numeric;

-- 3. Trigger: auto-calc boxes_produced from product_output_units (100 units = 1 box)
CREATE OR REPLACE FUNCTION fn_calc_boxes_from_units()
RETURNS trigger AS $$
BEGIN
  IF NEW.product_output_units IS NOT NULL AND NEW.product_output_units > 0 THEN
    NEW.boxes_produced := floor(NEW.product_output_units / 100);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calc_boxes_from_units ON production_batches;
CREATE TRIGGER trg_calc_boxes_from_units
  BEFORE INSERT OR UPDATE OF product_output_units ON production_batches
  FOR EACH ROW EXECUTE FUNCTION fn_calc_boxes_from_units();

-- 4. Updated snapshot trigger with boxes_per_lb and time_per_box
CREATE OR REPLACE FUNCTION fn_snapshot_conversion_on_approval()
RETURNS trigger AS $$
BEGIN
  IF NEW.inventory_state = 'approved' AND OLD.inventory_state IS DISTINCT FROM 'approved' THEN
    IF NEW.tobacco_lbs > 0 AND NEW.product_output_units > 0 THEN
      NEW.conversion_units_per_lb_snapshot := round(NEW.product_output_units::numeric / NEW.tobacco_lbs, 4);
      NEW.conversion_lbs_per_unit_snapshot := round(NEW.tobacco_lbs / NEW.product_output_units::numeric, 4);
    END IF;
    IF NEW.tobacco_lbs > 0 AND NEW.boxes_produced > 0 THEN
      NEW.conversion_boxes_per_lb_snapshot := round(NEW.boxes_produced::numeric / NEW.tobacco_lbs, 4);
    END IF;
    IF NEW.production_time_minutes > 0 AND NEW.product_output_units > 0 THEN
      NEW.time_per_unit_snapshot := round(NEW.production_time_minutes / NEW.product_output_units::numeric, 4);
    END IF;
    IF NEW.production_time_minutes > 0 AND NEW.boxes_produced > 0 THEN
      NEW.time_per_box_snapshot := round(NEW.production_time_minutes / NEW.boxes_produced::numeric, 4);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_snapshot_conversion_on_approval ON production_batches;
CREATE TRIGGER trg_snapshot_conversion_on_approval
  BEFORE UPDATE ON production_batches
  FOR EACH ROW EXECUTE FUNCTION fn_snapshot_conversion_on_approval();

-- 5. Backfill: set product_output_units from boxes_produced for existing tube records
UPDATE production_batches 
SET product_output_units = boxes_produced * 100
WHERE product_type = 'tubes' 
  AND boxes_produced > 0 
  AND (product_output_units IS NULL OR product_output_units = 0);

-- 6. Recreate conversion intelligence view with two-layer model
DROP VIEW IF EXISTS v_tobacco_conversion_intelligence;
CREATE OR REPLACE VIEW v_tobacco_conversion_intelligence AS
SELECT
  b.id AS batch_id,
  b.office_id,
  b.brand,
  b.batch_date,
  b.tobacco_lbs,
  b.boxes_produced,
  b.product_type,
  b.product_output_units,
  b.production_time_minutes,
  b.waste_lbs,
  b.tubes_total,
  b.status,
  b.inventory_state,
  b.is_locked,
  b.notes,
  b.created_at,
  b.created_by,
  -- Unit conversions
  CASE WHEN b.tobacco_lbs > 0 AND b.product_output_units > 0
    THEN round(b.tobacco_lbs / b.product_output_units::numeric, 4) 
    ELSE NULL END AS lbs_per_unit,
  CASE WHEN b.tobacco_lbs > 0 AND b.product_output_units > 0
    THEN round(b.product_output_units::numeric / b.tobacco_lbs, 4) 
    ELSE NULL END AS units_per_lb,
  -- Box conversions
  CASE WHEN b.tobacco_lbs > 0 AND b.boxes_produced > 0
    THEN round(b.tobacco_lbs / b.boxes_produced::numeric, 4) 
    ELSE NULL END AS lbs_per_box,
  CASE WHEN b.tobacco_lbs > 0 AND b.boxes_produced > 0
    THEN round(b.boxes_produced::numeric / b.tobacco_lbs, 4) 
    ELSE NULL END AS boxes_per_lb,
  -- Time
  CASE WHEN b.production_time_minutes > 0 AND b.product_output_units > 0
    THEN round(b.production_time_minutes / b.product_output_units::numeric, 4) 
    ELSE NULL END AS time_per_unit,
  CASE WHEN b.production_time_minutes > 0 AND b.boxes_produced > 0
    THEN round(b.production_time_minutes / b.boxes_produced::numeric, 4) 
    ELSE NULL END AS time_per_box,
  -- Waste
  CASE WHEN b.tobacco_lbs > 0 AND b.waste_lbs IS NOT NULL
    THEN round((b.waste_lbs / b.tobacco_lbs) * 100, 2) 
    ELSE NULL END AS waste_pct,
  -- Cost
  c.total_cost,
  CASE WHEN b.product_output_units > 0 AND c.total_cost IS NOT NULL
    THEN round(c.total_cost / b.product_output_units::numeric, 2) 
    ELSE NULL END AS cost_per_unit,
  CASE WHEN b.boxes_produced > 0 AND c.total_cost IS NOT NULL
    THEN round(c.total_cost / b.boxes_produced::numeric, 2) 
    ELSE NULL END AS cost_per_box,
  o.name AS office_name
FROM production_batches b
LEFT JOIN production_offices o ON o.id = b.office_id
LEFT JOIN (
  SELECT batch_id, sum(coalesce(total_material_cost, 0) + coalesce(labor_cost, 0)) AS total_cost
  FROM production_batch_costs
  GROUP BY batch_id
) c ON c.batch_id = b.id
WHERE b.tobacco_lbs > 0;
