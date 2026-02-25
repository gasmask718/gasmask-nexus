-- Must drop dependent view first, then recreate both
DROP VIEW IF EXISTS v_inventory_coverage_intelligence;
DROP VIEW IF EXISTS v_sku_sales_velocity;

CREATE VIEW v_sku_sales_velocity AS
WITH date_bounds AS (
  SELECT CURRENT_DATE AS today,
    CURRENT_DATE - '7 days'::interval AS d7,
    CURRENT_DATE - '14 days'::interval AS d14,
    CURRENT_DATE - '30 days'::interval AS d30
), line_sales AS (
  SELECT ili.brand,
    COALESCE(p.track_by, 'tubes') AS product_type,
    COALESCE(ili.quantity_boxes, 0::numeric) AS boxes_sold,
    i.finalized_at
  FROM invoice_line_items ili
    JOIN invoices i ON ili.invoice_id = i.id
    LEFT JOIN products p ON ili.product_id = p.id
    CROSS JOIN date_bounds db_1
  WHERE i.status = 'finalized' AND i.deleted_at IS NULL AND i.finalized_at IS NOT NULL AND i.finalized_at >= db_1.d30
)
SELECT ls.brand,
  ls.product_type,
  COALESCE(sum(ls.boxes_sold) FILTER (WHERE ls.finalized_at >= db.d7), 0::numeric) AS units_sold_last_7_days,
  COALESCE(sum(ls.boxes_sold) FILTER (WHERE ls.finalized_at >= db.d14), 0::numeric) AS units_sold_last_14_days,
  COALESCE(sum(ls.boxes_sold), 0::numeric) AS units_sold_last_30_days,
  CASE
    WHEN COALESCE(sum(ls.boxes_sold), 0::numeric) > 0 THEN round(COALESCE(sum(ls.boxes_sold), 0::numeric) / 30.0, 2)
    ELSE 0::numeric
  END AS avg_daily_velocity_30d,
  CASE
    WHEN COALESCE(sum(ls.boxes_sold) FILTER (WHERE ls.finalized_at >= db.d14), 0::numeric) > 0 THEN round(COALESCE(sum(ls.boxes_sold) FILTER (WHERE ls.finalized_at >= db.d14), 0::numeric) / 14.0, 2)
    ELSE 0::numeric
  END AS avg_daily_velocity_14d,
  CASE
    WHEN COALESCE(sum(ls.boxes_sold), 0::numeric) > 0 AND round(COALESCE(sum(ls.boxes_sold) FILTER (WHERE ls.finalized_at >= db.d14), 0::numeric) / 14.0, 2) > (round(COALESCE(sum(ls.boxes_sold), 0::numeric) / 30.0, 2) * 1.15) THEN 'accelerating'
    WHEN COALESCE(sum(ls.boxes_sold), 0::numeric) > 0 AND round(COALESCE(sum(ls.boxes_sold) FILTER (WHERE ls.finalized_at >= db.d14), 0::numeric) / 14.0, 2) < (round(COALESCE(sum(ls.boxes_sold), 0::numeric) / 30.0, 2) * 0.85) THEN 'declining'
    ELSE 'stable'
  END AS demand_trend
FROM line_sales ls
  CROSS JOIN date_bounds db
GROUP BY ls.brand, ls.product_type;

CREATE VIEW v_inventory_coverage_intelligence AS
WITH finished_inventory AS (
  SELECT production_batches.brand,
    sum(COALESCE(production_batches.boxes_produced, 0)) AS current_boxes_available
  FROM production_batches
  WHERE production_batches.inventory_state = ANY (ARRAY['approved', 'sent_to_office'])
  GROUP BY production_batches.brand
), raw_inventory AS (
  SELECT sum(COALESCE(production_raw_materials.quantity, 0::numeric)) AS total_raw_lbs
  FROM production_raw_materials
  WHERE production_raw_materials.material_type = 'tobacco' AND production_raw_materials.unit = 'lbs'
), global_baseline AS (
  SELECT production_conversion_baseline.baseline_boxes_per_lb,
    production_conversion_baseline.baseline_lbs_per_box
  FROM production_conversion_baseline
  WHERE production_conversion_baseline.office_id IS NULL
  ORDER BY production_conversion_baseline.last_updated_at DESC
  LIMIT 1
)
SELECT sv.brand,
  sv.product_type,
  COALESCE(fi.current_boxes_available, 0::bigint) AS current_boxes_available,
  sv.units_sold_last_7_days, sv.units_sold_last_14_days, sv.units_sold_last_30_days,
  sv.avg_daily_velocity_30d, sv.avg_daily_velocity_14d, sv.demand_trend,
  CASE WHEN sv.avg_daily_velocity_30d > 0 THEN round(COALESCE(fi.current_boxes_available, 0::bigint)::numeric / sv.avg_daily_velocity_30d, 1) ELSE NULL::numeric END AS days_of_inventory_remaining,
  CASE
    WHEN sv.avg_daily_velocity_30d = 0 THEN 'no_demand'
    WHEN (COALESCE(fi.current_boxes_available, 0::bigint)::numeric / NULLIF(sv.avg_daily_velocity_30d, 0)) < 7 THEN 'critical'
    WHEN (COALESCE(fi.current_boxes_available, 0::bigint)::numeric / NULLIF(sv.avg_daily_velocity_30d, 0)) < 14 THEN 'red'
    WHEN (COALESCE(fi.current_boxes_available, 0::bigint)::numeric / NULLIF(sv.avg_daily_velocity_30d, 0)) <= 21 THEN 'amber'
    ELSE 'green'
  END AS risk_level,
  GREATEST(0::numeric, round(sv.avg_daily_velocity_30d * 30 - COALESCE(fi.current_boxes_available, 0::bigint)::numeric, 0)) AS required_boxes_for_30_days,
  CASE WHEN gb.baseline_boxes_per_lb > 0 THEN round(GREATEST(0::numeric, sv.avg_daily_velocity_30d * 30 - COALESCE(fi.current_boxes_available, 0::bigint)::numeric) / gb.baseline_boxes_per_lb * 1.10, 1) ELSE NULL::numeric END AS recommended_lbs_to_produce,
  COALESCE(ri.total_raw_lbs, 0::numeric) AS raw_inventory_lbs,
  CASE WHEN gb.baseline_boxes_per_lb > 0 THEN GREATEST(0::numeric, round(GREATEST(0::numeric, sv.avg_daily_velocity_30d * 30 - COALESCE(fi.current_boxes_available, 0::bigint)::numeric) / gb.baseline_boxes_per_lb * 1.10 - COALESCE(ri.total_raw_lbs, 0::numeric), 1)) ELSE NULL::numeric END AS procurement_needed_lbs,
  CASE WHEN sv.avg_daily_velocity_30d > 0 AND (COALESCE(fi.current_boxes_available, 0::bigint)::numeric / sv.avg_daily_velocity_30d) > 45 THEN true ELSE false END AS is_overstock,
  gb.baseline_boxes_per_lb, gb.baseline_lbs_per_box
FROM v_sku_sales_velocity sv
  LEFT JOIN finished_inventory fi ON fi.brand = sv.brand
  CROSS JOIN raw_inventory ri
  CROSS JOIN global_baseline gb;