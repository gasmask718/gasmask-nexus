
-- Tobacco Conversion Intelligence View
CREATE OR REPLACE VIEW public.v_tobacco_conversion_intelligence AS
SELECT
  b.id AS batch_id,
  b.office_id,
  b.brand,
  b.batch_date,
  b.tobacco_lbs,
  b.boxes_produced,
  b.waste_lbs,
  b.tubes_total,
  b.status,
  b.inventory_state,
  b.is_locked,
  b.notes,
  b.created_at,
  b.created_by,
  CASE WHEN b.tobacco_lbs > 0 AND b.boxes_produced > 0
    THEN ROUND((b.tobacco_lbs / b.boxes_produced)::numeric, 4)
    ELSE NULL END AS lbs_per_box,
  CASE WHEN b.tobacco_lbs > 0 AND b.boxes_produced > 0
    THEN ROUND((b.boxes_produced::numeric / b.tobacco_lbs), 4)
    ELSE NULL END AS boxes_per_lb,
  CASE WHEN b.tobacco_lbs > 0 AND b.waste_lbs IS NOT NULL
    THEN ROUND((b.waste_lbs / b.tobacco_lbs * 100)::numeric, 2)
    ELSE NULL END AS waste_pct,
  c.total_cost,
  CASE WHEN b.boxes_produced > 0 AND c.total_cost IS NOT NULL
    THEN ROUND((c.total_cost / b.boxes_produced)::numeric, 2)
    ELSE NULL END AS cost_per_box,
  o.name AS office_name
FROM public.production_batches b
LEFT JOIN public.production_offices o ON o.id = b.office_id
LEFT JOIN (
  SELECT batch_id,
    COALESCE(total_material_cost, 0) + COALESCE(labor_cost, 0) AS total_cost
  FROM public.production_batch_costs
) c ON c.batch_id = b.id
WHERE b.tobacco_lbs IS NOT NULL AND b.tobacco_lbs > 0;

GRANT SELECT ON public.v_tobacco_conversion_intelligence TO authenticated;
