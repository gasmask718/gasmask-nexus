
-- ============================================================
-- MULTI-PRODUCT PRODUCTION INTELLIGENCE MIGRATION
-- ============================================================

-- 1. Add columns to production_batches
ALTER TABLE public.production_batches
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'tubes',
  ADD COLUMN IF NOT EXISTS product_output_units integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS production_start_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS production_end_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS production_time_minutes numeric,
  ADD COLUMN IF NOT EXISTS conversion_units_per_lb_snapshot numeric,
  ADD COLUMN IF NOT EXISTS conversion_lbs_per_unit_snapshot numeric,
  ADD COLUMN IF NOT EXISTS time_per_unit_snapshot numeric;

-- 2. Backfill existing records: product_output_units = boxes_produced for tubes
UPDATE public.production_batches
SET product_output_units = COALESCE(boxes_produced, 0)
WHERE product_type = 'tubes' AND (product_output_units IS NULL OR product_output_units = 0) AND boxes_produced IS NOT NULL AND boxes_produced > 0;

-- 3. Add product_type and new baseline columns to production_conversion_baseline
ALTER TABLE public.production_conversion_baseline
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'tubes',
  ADD COLUMN IF NOT EXISTS baseline_units_per_lb numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS baseline_lbs_per_unit numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS baseline_time_per_unit numeric;

-- 4. Backfill baseline with existing data
UPDATE public.production_conversion_baseline
SET baseline_units_per_lb = baseline_boxes_per_lb,
    baseline_lbs_per_unit = baseline_lbs_per_box
WHERE product_type = 'tubes' AND (baseline_units_per_lb IS NULL OR baseline_units_per_lb = 0);

-- 5. Drop and recreate the conversion intelligence view to be product-aware
DROP VIEW IF EXISTS public.v_tobacco_conversion_intelligence;

CREATE VIEW public.v_tobacco_conversion_intelligence AS
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
  CASE WHEN b.tobacco_lbs > 0 AND b.product_output_units > 0
    THEN round(b.tobacco_lbs / b.product_output_units::numeric, 4) ELSE NULL END AS lbs_per_unit,
  CASE WHEN b.tobacco_lbs > 0 AND b.product_output_units > 0
    THEN round(b.product_output_units::numeric / b.tobacco_lbs, 4) ELSE NULL END AS units_per_lb,
  CASE WHEN b.tobacco_lbs > 0 AND b.boxes_produced > 0
    THEN round(b.tobacco_lbs / b.boxes_produced::numeric, 4) ELSE NULL END AS lbs_per_box,
  CASE WHEN b.tobacco_lbs > 0 AND b.boxes_produced > 0
    THEN round(b.boxes_produced::numeric / b.tobacco_lbs, 4) ELSE NULL END AS boxes_per_lb,
  CASE WHEN b.tobacco_lbs > 0 AND b.waste_lbs IS NOT NULL
    THEN round((b.waste_lbs / b.tobacco_lbs) * 100, 2) ELSE NULL END AS waste_pct,
  CASE WHEN b.production_time_minutes > 0 AND b.product_output_units > 0
    THEN round(b.production_time_minutes / b.product_output_units::numeric, 4) ELSE NULL END AS time_per_unit,
  c.total_cost,
  CASE WHEN b.product_output_units > 0 AND c.total_cost IS NOT NULL
    THEN round(c.total_cost / b.product_output_units::numeric, 2) ELSE NULL END AS cost_per_unit,
  CASE WHEN b.boxes_produced > 0 AND c.total_cost IS NOT NULL
    THEN round(c.total_cost / b.boxes_produced::numeric, 2) ELSE NULL END AS cost_per_box,
  o.name AS office_name
FROM production_batches b
LEFT JOIN production_offices o ON o.id = b.office_id
LEFT JOIN (
  SELECT batch_id, COALESCE(total_material_cost, 0) + COALESCE(labor_cost, 0) AS total_cost
  FROM production_batch_costs
) c ON c.batch_id = b.id
WHERE b.tobacco_lbs IS NOT NULL AND b.tobacco_lbs > 0;

-- 6. Auto-calculate production_time_minutes trigger
CREATE OR REPLACE FUNCTION public.fn_calc_production_time()
RETURNS trigger AS $$
BEGIN
  IF NEW.production_start_timestamp IS NOT NULL AND NEW.production_end_timestamp IS NOT NULL THEN
    NEW.production_time_minutes := ROUND(
      EXTRACT(EPOCH FROM (NEW.production_end_timestamp - NEW.production_start_timestamp)) / 60.0, 2
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calc_production_time ON public.production_batches;
CREATE TRIGGER trg_calc_production_time
  BEFORE INSERT OR UPDATE ON public.production_batches
  FOR EACH ROW EXECUTE FUNCTION public.fn_calc_production_time();

-- 7. Sync product_output_units with boxes_produced for tubes
CREATE OR REPLACE FUNCTION public.fn_sync_product_output_units()
RETURNS trigger AS $$
BEGIN
  IF NEW.product_type = 'tubes' AND NEW.boxes_produced IS NOT NULL THEN
    NEW.product_output_units := NEW.boxes_produced;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_product_output_units ON public.production_batches;
CREATE TRIGGER trg_sync_product_output_units
  BEFORE INSERT OR UPDATE ON public.production_batches
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_product_output_units();

-- 8. Snapshot conversion on approval (product-aware)
CREATE OR REPLACE FUNCTION public.fn_snapshot_conversion_on_approval()
RETURNS trigger AS $$
BEGIN
  IF NEW.inventory_state = 'approved' AND OLD.inventory_state != 'approved' THEN
    IF NEW.tobacco_lbs > 0 AND NEW.product_output_units > 0 THEN
      NEW.conversion_units_per_lb_snapshot := ROUND(NEW.product_output_units::numeric / NEW.tobacco_lbs, 4);
      NEW.conversion_lbs_per_unit_snapshot := ROUND(NEW.tobacco_lbs / NEW.product_output_units::numeric, 4);
    END IF;
    IF NEW.product_type = 'tubes' AND NEW.tobacco_lbs > 0 AND NEW.boxes_produced > 0 THEN
      NEW.conversion_boxes_per_lb_snapshot := ROUND(NEW.boxes_produced::numeric / NEW.tobacco_lbs, 4);
      NEW.conversion_lbs_per_box_snapshot := ROUND(NEW.tobacco_lbs / NEW.boxes_produced::numeric, 4);
    END IF;
    IF NEW.production_time_minutes > 0 AND NEW.product_output_units > 0 THEN
      NEW.time_per_unit_snapshot := ROUND(NEW.production_time_minutes / NEW.product_output_units::numeric, 4);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_snapshot_conversion ON public.production_batches;
CREATE TRIGGER trg_snapshot_conversion
  BEFORE UPDATE ON public.production_batches
  FOR EACH ROW EXECUTE FUNCTION public.fn_snapshot_conversion_on_approval();
