CREATE OR REPLACE FUNCTION public.fn_guard_approved_batch_fields()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status = 'approved' THEN
    IF (
      NEW.labor_model IS DISTINCT FROM OLD.labor_model OR
      NEW.worker_count IS DISTINCT FROM OLD.worker_count OR
      NEW.selected_worker_ids IS DISTINCT FROM OLD.selected_worker_ids OR
      NEW.labor_hourly_rate_snapshot IS DISTINCT FROM OLD.labor_hourly_rate_snapshot OR
      NEW.labor_per_box_rate_snapshot IS DISTINCT FROM OLD.labor_per_box_rate_snapshot OR
      NEW.labor_flat_day_rate_snapshot IS DISTINCT FROM OLD.labor_flat_day_rate_snapshot OR
      NEW.production_time_minutes IS DISTINCT FROM OLD.production_time_minutes OR
      NEW.changeover_minutes IS DISTINCT FROM OLD.changeover_minutes
    ) THEN
      IF NOT public.has_role(auth.uid(), 'owner') THEN
        RAISE EXCEPTION 'LOCKED: Cannot modify cost fields on an approved batch. Owner override required.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

ALTER TABLE public.production_batches
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_production_batches_is_test
  ON public.production_batches (is_test) WHERE is_test = true;

UPDATE public.production_batches
   SET is_test = true
 WHERE id IN (
   'd098bcec-3658-4952-bd6f-789c7ef77d85',
   '9700395e-5f71-4413-96aa-22ed9796a383',
   '59a57077-8624-4a01-b983-4b938e28a63f',
   '3c1fbbf7-a4aa-417e-810c-4c52d96aff82',
   'b14fd5a8-b4b7-48be-aed2-d330c2cf9977',
   'af398506-30e2-40ba-a340-c3daffc3d6ce'
 );

DROP VIEW IF EXISTS public.v_tobacco_conversion_intelligence;

CREATE VIEW public.v_tobacco_conversion_intelligence AS
SELECT b.id AS batch_id, b.office_id, b.brand, b.batch_date, b.shift_label,
    b.tobacco_lbs, b.boxes_produced, b.product_type, b.product_output_units,
    b.boxes_full, b.units_remainder, b.boxes_equivalent,
    b.production_time_minutes, b.changeover_minutes, b.net_production_minutes,
    b.waste_lbs, b.tubes_total, b.status, b.inventory_state, b.is_locked,
    b.is_test, b.notes, b.created_at, b.created_by,
    CASE WHEN b.tobacco_lbs > 0 AND b.product_output_units > 0 THEN round(b.tobacco_lbs / b.product_output_units::numeric, 4) END AS lbs_per_unit,
    CASE WHEN b.tobacco_lbs > 0 AND b.product_output_units > 0 THEN round(b.product_output_units::numeric / b.tobacco_lbs, 4) END AS units_per_lb,
    CASE WHEN b.tobacco_lbs > 0 AND b.boxes_equivalent > 0 THEN round(b.tobacco_lbs / b.boxes_equivalent, 4) END AS lbs_per_box,
    CASE WHEN b.tobacco_lbs > 0 AND b.boxes_equivalent > 0 THEN round(b.boxes_equivalent / b.tobacco_lbs, 4) END AS boxes_per_lb,
    CASE WHEN b.production_time_minutes > 0 AND b.product_output_units > 0 THEN round(b.production_time_minutes / b.product_output_units::numeric, 4) END AS time_per_unit,
    CASE WHEN b.production_time_minutes > 0 AND b.boxes_equivalent > 0 THEN round(b.production_time_minutes / b.boxes_equivalent, 4) END AS time_per_box,
    CASE WHEN b.net_production_minutes > 0 AND b.product_output_units > 0 THEN round(b.net_production_minutes / b.product_output_units::numeric, 4) END AS net_time_per_unit,
    CASE WHEN b.net_production_minutes > 0 AND b.boxes_equivalent > 0 THEN round(b.net_production_minutes / b.boxes_equivalent, 4) END AS net_time_per_box,
    CASE WHEN b.tobacco_lbs > 0 AND b.waste_lbs IS NOT NULL THEN round(b.waste_lbs / b.tobacco_lbs * 100, 2) END AS waste_pct,
    c.total_cost,
    CASE WHEN b.product_output_units > 0 AND c.total_cost IS NOT NULL THEN round(c.total_cost / b.product_output_units::numeric, 2) END AS cost_per_unit,
    CASE WHEN b.boxes_equivalent > 0 AND c.total_cost IS NOT NULL THEN round(c.total_cost / b.boxes_equivalent, 2) END AS cost_per_box,
    o.name AS office_name
FROM public.production_batches b
LEFT JOIN public.production_offices o ON o.id = b.office_id
LEFT JOIN (
  SELECT batch_id, sum(COALESCE(total_material_cost, 0) + COALESCE(labor_cost, 0)) AS total_cost
    FROM public.production_batch_costs GROUP BY batch_id
) c ON c.batch_id = b.id
WHERE b.tobacco_lbs > 0 AND b.is_test = false;

GRANT SELECT ON public.v_tobacco_conversion_intelligence TO authenticated, service_role;