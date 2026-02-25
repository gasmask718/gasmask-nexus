-- SECTION 1: v_raw_inventory_available_by_product
CREATE OR REPLACE VIEW v_raw_inventory_available_by_product AS
WITH physical_pool AS (
  SELECT office_id, SUM(COALESCE(quantity, 0)) AS total_lbs_available
  FROM production_raw_materials
  WHERE material_type = 'tobacco' AND unit = 'lbs'
  GROUP BY office_id
),
product_reservations AS (
  SELECT office_id, product_type, COALESCE(reserved_lbs, 0) AS reserved_lbs
  FROM raw_material_allocations
),
total_reserved AS (
  SELECT office_id, SUM(COALESCE(reserved_lbs, 0)) AS total_reserved_lbs
  FROM raw_material_allocations
  GROUP BY office_id
),
office_products AS (
  SELECT DISTINCT office_id, product_type FROM raw_material_allocations
  UNION
  SELECT DISTINCT office_id, product_type FROM production_batches WHERE product_type IS NOT NULL AND office_id IS NOT NULL
)
SELECT
  op.office_id,
  op.product_type,
  COALESCE(pp.total_lbs_available, 0) AS total_lbs_available,
  COALESCE(pr.reserved_lbs, 0) AS reserved_lbs,
  GREATEST(0, COALESCE(pp.total_lbs_available, 0) - COALESCE(tr.total_reserved_lbs, 0)) AS unallocated_lbs,
  COALESCE(pr.reserved_lbs, 0) + GREATEST(0, COALESCE(pp.total_lbs_available, 0) - COALESCE(tr.total_reserved_lbs, 0)) AS available_for_product_lbs,
  CASE
    WHEN COALESCE(pp.total_lbs_available, 0) > 0 
    THEN ROUND(GREATEST(0, COALESCE(pp.total_lbs_available, 0) - COALESCE(tr.total_reserved_lbs, 0)) / pp.total_lbs_available * 100, 1)
    ELSE 0
  END AS unallocated_pct
FROM office_products op
LEFT JOIN physical_pool pp ON pp.office_id = op.office_id
LEFT JOIN product_reservations pr ON pr.office_id = op.office_id AND pr.product_type = op.product_type
LEFT JOIN total_reserved tr ON tr.office_id = op.office_id;

-- SECTION 2+3+4: Recreate v_inventory_coverage_intelligence (product-aware + safe raw + stability procurement)
DROP VIEW IF EXISTS v_inventory_coverage_intelligence;

CREATE OR REPLACE VIEW v_inventory_coverage_intelligence AS
WITH finished_inventory AS (
  SELECT brand, product_type,
    SUM(COALESCE(boxes_equivalent, boxes_produced, 0)) AS current_boxes_available
  FROM production_batches
  WHERE inventory_state IN ('approved', 'sent_to_office')
  GROUP BY brand, product_type
),
product_baselines AS (
  SELECT DISTINCT ON (product_type) product_type, baseline_boxes_per_lb, baseline_lbs_per_box
  FROM production_conversion_baseline
  WHERE office_id IS NULL
  ORDER BY product_type, last_updated_at DESC
),
global_baseline_fallback AS (
  SELECT baseline_boxes_per_lb, baseline_lbs_per_box
  FROM production_conversion_baseline
  WHERE office_id IS NULL
  ORDER BY last_updated_at DESC
  LIMIT 1
),
safe_raw AS (
  SELECT product_type,
    SUM(available_for_product_lbs) AS raw_safe_lbs,
    SUM(reserved_lbs) AS raw_reserved_lbs,
    SUM(unallocated_lbs) AS raw_unallocated_lbs,
    MIN(unallocated_pct) AS min_unallocated_pct
  FROM v_raw_inventory_available_by_product
  GROUP BY product_type
),
raw_total_fallback AS (
  SELECT SUM(COALESCE(quantity, 0)) AS total_raw_lbs
  FROM production_raw_materials
  WHERE material_type = 'tobacco' AND unit = 'lbs'
)
SELECT
  sv.brand,
  sv.product_type,
  COALESCE(fi.current_boxes_available, 0)::bigint AS current_boxes_available,
  sv.units_sold_last_7_days,
  sv.units_sold_last_14_days,
  sv.units_sold_last_30_days,
  sv.avg_daily_velocity_30d,
  sv.avg_daily_velocity_14d,
  sv.demand_trend,
  CASE WHEN sv.avg_daily_velocity_30d > 0 THEN ROUND(COALESCE(fi.current_boxes_available, 0)::numeric / sv.avg_daily_velocity_30d, 1) ELSE NULL END AS days_of_inventory_remaining,
  CASE
    WHEN sv.avg_daily_velocity_30d = 0 THEN 'no_demand'
    WHEN (COALESCE(fi.current_boxes_available, 0)::numeric / NULLIF(sv.avg_daily_velocity_30d, 0)) < 7 THEN 'critical'
    WHEN (COALESCE(fi.current_boxes_available, 0)::numeric / NULLIF(sv.avg_daily_velocity_30d, 0)) < 14 THEN 'red'
    WHEN (COALESCE(fi.current_boxes_available, 0)::numeric / NULLIF(sv.avg_daily_velocity_30d, 0)) <= 21 THEN 'amber'
    ELSE 'green'
  END AS risk_level,
  GREATEST(0, ROUND(sv.avg_daily_velocity_30d * 30 - COALESCE(fi.current_boxes_available, 0)::numeric, 0)) AS required_boxes_for_30_days,
  CASE
    WHEN COALESCE(pb.baseline_boxes_per_lb, gbf.baseline_boxes_per_lb, 0) > 0
    THEN ROUND(GREATEST(0, sv.avg_daily_velocity_30d * 30 - COALESCE(fi.current_boxes_available, 0)::numeric) / COALESCE(pb.baseline_boxes_per_lb, gbf.baseline_boxes_per_lb) * 1.10, 1)
    ELSE NULL
  END AS recommended_lbs_to_produce,
  -- Product-safe raw (backward compatible field name)
  COALESCE(sr.raw_safe_lbs, rtf.total_raw_lbs, 0) AS raw_inventory_lbs,
  -- Reservation-aware fields
  COALESCE(sr.raw_reserved_lbs, 0) AS raw_reserved_lbs,
  COALESCE(sr.raw_unallocated_lbs, rtf.total_raw_lbs, 0) AS raw_unallocated_lbs,
  COALESCE(sr.raw_safe_lbs, rtf.total_raw_lbs, 0) AS raw_safe_lbs,
  COALESCE(sr.min_unallocated_pct, 100) AS unallocated_pct,
  -- Stability-first procurement: recommended - safe raw (no borrowing)
  CASE
    WHEN COALESCE(pb.baseline_boxes_per_lb, gbf.baseline_boxes_per_lb, 0) > 0
    THEN GREATEST(0, ROUND(
      GREATEST(0, sv.avg_daily_velocity_30d * 30 - COALESCE(fi.current_boxes_available, 0)::numeric)
      / COALESCE(pb.baseline_boxes_per_lb, gbf.baseline_boxes_per_lb) * 1.10
      - COALESCE(sr.raw_safe_lbs, rtf.total_raw_lbs, 0), 1))
    ELSE NULL
  END AS procurement_needed_lbs,
  CASE WHEN sv.avg_daily_velocity_30d > 0 AND (COALESCE(fi.current_boxes_available, 0)::numeric / sv.avg_daily_velocity_30d) > 45 THEN true ELSE false END AS is_overstock,
  -- Stability guardrail: auto-draft blocked when unallocated < 8%
  CASE WHEN COALESCE(sr.min_unallocated_pct, 100) < 8 THEN true ELSE false END AS auto_draft_blocked,
  COALESCE(pb.baseline_boxes_per_lb, gbf.baseline_boxes_per_lb) AS baseline_boxes_per_lb,
  COALESCE(pb.baseline_lbs_per_box, gbf.baseline_lbs_per_box) AS baseline_lbs_per_box
FROM v_sku_sales_velocity sv
LEFT JOIN finished_inventory fi ON fi.brand = sv.brand AND fi.product_type = sv.product_type
LEFT JOIN product_baselines pb ON pb.product_type = sv.product_type
LEFT JOIN safe_raw sr ON sr.product_type = sv.product_type
CROSS JOIN global_baseline_fallback gbf
CROSS JOIN raw_total_fallback rtf;

-- SECTION 7: Procurement recommendation logs
CREATE TABLE IF NOT EXISTS procurement_recommendation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES production_offices(id),
  brand TEXT NOT NULL,
  product_type TEXT NOT NULL DEFAULT 'tubes',
  recommended_lbs_to_produce NUMERIC NOT NULL DEFAULT 0,
  raw_safe_lbs NUMERIC NOT NULL DEFAULT 0,
  procurement_needed_lbs NUMERIC NOT NULL DEFAULT 0,
  buffer_pct NUMERIC NOT NULL DEFAULT 0,
  auto_draft_blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE procurement_recommendation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read procurement logs"
  ON procurement_recommendation_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert procurement logs"
  ON procurement_recommendation_logs FOR INSERT TO authenticated WITH CHECK (true);