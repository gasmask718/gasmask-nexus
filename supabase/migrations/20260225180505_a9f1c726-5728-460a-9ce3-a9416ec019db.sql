
-- =====================================================
-- PRODUCTION HARDENING: Remainder, Changeover, Shift Baselines
-- =====================================================

-- 1. Add computed remainder + equivalent columns
ALTER TABLE production_batches
  ADD COLUMN IF NOT EXISTS boxes_full integer GENERATED ALWAYS AS (
    CASE WHEN product_output_units > 0 THEN floor(product_output_units / 100) ELSE 0 END
  ) STORED,
  ADD COLUMN IF NOT EXISTS units_remainder integer GENERATED ALWAYS AS (
    CASE WHEN product_output_units > 0 THEN product_output_units % 100 ELSE 0 END
  ) STORED,
  ADD COLUMN IF NOT EXISTS boxes_equivalent numeric GENERATED ALWAYS AS (
    CASE WHEN product_output_units > 0 THEN round(product_output_units / 100.0, 4) ELSE 0 END
  ) STORED;

-- 2. Add changeover time tracking
ALTER TABLE production_batches
  ADD COLUMN IF NOT EXISTS changeover_minutes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_production_minutes numeric GENERATED ALWAYS AS (
    CASE WHEN production_time_minutes IS NOT NULL 
      THEN greatest(production_time_minutes - coalesce(changeover_minutes, 0), 0)
      ELSE NULL END
  ) STORED;

-- 3. Add gross/net snapshot columns
ALTER TABLE production_batches
  ADD COLUMN IF NOT EXISTS time_per_unit_net_snapshot numeric,
  ADD COLUMN IF NOT EXISTS time_per_box_net_snapshot numeric;

-- 4. Add shift_label to baseline table
ALTER TABLE production_conversion_baseline
  ADD COLUMN IF NOT EXISTS shift_label text;

-- 5. Update trigger: use boxes_equivalent for yield math, net_minutes for time
-- Drop old trigger that auto-calcs boxes_produced (now a generated column handles it differently)
-- Actually boxes_produced is still the old column used by other systems, keep it synced
CREATE OR REPLACE FUNCTION fn_calc_boxes_from_units()
RETURNS trigger AS $$
BEGIN
  IF NEW.product_output_units IS NOT NULL AND NEW.product_output_units > 0 THEN
    NEW.boxes_produced := floor(NEW.product_output_units / 100);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Update snapshot trigger to use boxes_equivalent and net time
CREATE OR REPLACE FUNCTION fn_snapshot_conversion_on_approval()
RETURNS trigger AS $$
DECLARE
  v_boxes_equiv numeric;
  v_net_minutes numeric;
BEGIN
  IF NEW.inventory_state = 'approved' AND OLD.inventory_state IS DISTINCT FROM 'approved' THEN
    v_boxes_equiv := CASE WHEN NEW.product_output_units > 0 
      THEN round(NEW.product_output_units / 100.0, 4) ELSE 0 END;
    v_net_minutes := greatest(
      coalesce(NEW.production_time_minutes, 0) - coalesce(NEW.changeover_minutes, 0), 0
    );

    -- Units per lb (using raw units)
    IF NEW.tobacco_lbs > 0 AND NEW.product_output_units > 0 THEN
      NEW.conversion_units_per_lb_snapshot := round(NEW.product_output_units::numeric / NEW.tobacco_lbs, 4);
      NEW.conversion_lbs_per_unit_snapshot := round(NEW.tobacco_lbs / NEW.product_output_units::numeric, 4);
    END IF;

    -- Boxes per lb (using boxes_equivalent for precision)
    IF NEW.tobacco_lbs > 0 AND v_boxes_equiv > 0 THEN
      NEW.conversion_boxes_per_lb_snapshot := round(v_boxes_equiv / NEW.tobacco_lbs, 4);
    END IF;

    -- Gross time snapshots
    IF NEW.production_time_minutes > 0 AND NEW.product_output_units > 0 THEN
      NEW.time_per_unit_snapshot := round(NEW.production_time_minutes / NEW.product_output_units::numeric, 4);
    END IF;
    IF NEW.production_time_minutes > 0 AND v_boxes_equiv > 0 THEN
      NEW.time_per_box_snapshot := round(NEW.production_time_minutes / v_boxes_equiv, 4);
    END IF;

    -- Net time snapshots (excludes changeover)
    IF v_net_minutes > 0 AND NEW.product_output_units > 0 THEN
      NEW.time_per_unit_net_snapshot := round(v_net_minutes / NEW.product_output_units::numeric, 4);
    END IF;
    IF v_net_minutes > 0 AND v_boxes_equiv > 0 THEN
      NEW.time_per_box_net_snapshot := round(v_net_minutes / v_boxes_equiv, 4);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_snapshot_conversion_on_approval ON production_batches;
CREATE TRIGGER trg_snapshot_conversion_on_approval
  BEFORE UPDATE ON production_batches
  FOR EACH ROW EXECUTE FUNCTION fn_snapshot_conversion_on_approval();

-- 7. Recreate view with boxes_equivalent, remainder, changeover, net time
DROP VIEW IF EXISTS v_tobacco_conversion_intelligence;
CREATE OR REPLACE VIEW v_tobacco_conversion_intelligence AS
SELECT
  b.id AS batch_id,
  b.office_id,
  b.brand,
  b.batch_date,
  b.shift_label,
  b.tobacco_lbs,
  b.boxes_produced,
  b.product_type,
  b.product_output_units,
  b.boxes_full,
  b.units_remainder,
  b.boxes_equivalent,
  b.production_time_minutes,
  b.changeover_minutes,
  b.net_production_minutes,
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
  -- Box conversions (using boxes_equivalent for precision)
  CASE WHEN b.tobacco_lbs > 0 AND b.boxes_equivalent > 0
    THEN round(b.tobacco_lbs / b.boxes_equivalent, 4) 
    ELSE NULL END AS lbs_per_box,
  CASE WHEN b.tobacco_lbs > 0 AND b.boxes_equivalent > 0
    THEN round(b.boxes_equivalent / b.tobacco_lbs, 4) 
    ELSE NULL END AS boxes_per_lb,
  -- Time (gross)
  CASE WHEN b.production_time_minutes > 0 AND b.product_output_units > 0
    THEN round(b.production_time_minutes / b.product_output_units::numeric, 4) 
    ELSE NULL END AS time_per_unit,
  CASE WHEN b.production_time_minutes > 0 AND b.boxes_equivalent > 0
    THEN round(b.production_time_minutes / b.boxes_equivalent, 4) 
    ELSE NULL END AS time_per_box,
  -- Time (net, excluding changeover)
  CASE WHEN b.net_production_minutes > 0 AND b.product_output_units > 0
    THEN round(b.net_production_minutes / b.product_output_units::numeric, 4) 
    ELSE NULL END AS net_time_per_unit,
  CASE WHEN b.net_production_minutes > 0 AND b.boxes_equivalent > 0
    THEN round(b.net_production_minutes / b.boxes_equivalent, 4) 
    ELSE NULL END AS net_time_per_box,
  -- Waste
  CASE WHEN b.tobacco_lbs > 0 AND b.waste_lbs IS NOT NULL
    THEN round((b.waste_lbs / b.tobacco_lbs) * 100, 2) 
    ELSE NULL END AS waste_pct,
  -- Cost
  c.total_cost,
  CASE WHEN b.product_output_units > 0 AND c.total_cost IS NOT NULL
    THEN round(c.total_cost / b.product_output_units::numeric, 2) 
    ELSE NULL END AS cost_per_unit,
  CASE WHEN b.boxes_equivalent > 0 AND c.total_cost IS NOT NULL
    THEN round(c.total_cost / b.boxes_equivalent, 2) 
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
