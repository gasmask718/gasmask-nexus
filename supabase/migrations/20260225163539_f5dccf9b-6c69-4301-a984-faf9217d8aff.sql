
-- ============================================================
-- SALES VELOCITY CLOSED-LOOP ENGINE
-- v_sku_sales_velocity + v_inventory_coverage_intelligence
-- + production_demand_overrides audit table
-- ============================================================

-- 1) SKU Sales Velocity View
-- Aggregates finalized invoice line items by brand
-- into 7/14/30-day velocity windows
CREATE OR REPLACE VIEW v_sku_sales_velocity AS
WITH date_bounds AS (
  SELECT
    CURRENT_DATE AS today,
    CURRENT_DATE - INTERVAL '7 days' AS d7,
    CURRENT_DATE - INTERVAL '14 days' AS d14,
    CURRENT_DATE - INTERVAL '30 days' AS d30
),
line_sales AS (
  SELECT
    ili.brand AS brand,
    COALESCE(ili.quantity_boxes, 0) AS boxes_sold,
    i.finalized_at
  FROM invoice_line_items ili
  JOIN invoices i ON ili.invoice_id = i.id
  CROSS JOIN date_bounds db
  WHERE i.status = 'finalized'
    AND i.deleted_at IS NULL
    AND i.finalized_at IS NOT NULL
    AND i.finalized_at >= db.d30
)
SELECT
  ls.brand,
  COALESCE(SUM(ls.boxes_sold) FILTER (WHERE ls.finalized_at >= db.d7), 0) AS units_sold_last_7_days,
  COALESCE(SUM(ls.boxes_sold) FILTER (WHERE ls.finalized_at >= db.d14), 0) AS units_sold_last_14_days,
  COALESCE(SUM(ls.boxes_sold), 0) AS units_sold_last_30_days,
  CASE WHEN COALESCE(SUM(ls.boxes_sold), 0) > 0
    THEN ROUND(COALESCE(SUM(ls.boxes_sold), 0)::numeric / 30.0, 2)
    ELSE 0 END AS avg_daily_velocity_30d,
  CASE WHEN COALESCE(SUM(ls.boxes_sold) FILTER (WHERE ls.finalized_at >= db.d14), 0) > 0
    THEN ROUND(COALESCE(SUM(ls.boxes_sold) FILTER (WHERE ls.finalized_at >= db.d14), 0)::numeric / 14.0, 2)
    ELSE 0 END AS avg_daily_velocity_14d,
  -- Drift detection
  CASE
    WHEN COALESCE(SUM(ls.boxes_sold), 0) > 0 AND
         ROUND(COALESCE(SUM(ls.boxes_sold) FILTER (WHERE ls.finalized_at >= db.d14), 0)::numeric / 14.0, 2) >
         ROUND(COALESCE(SUM(ls.boxes_sold), 0)::numeric / 30.0, 2) * 1.15
    THEN 'accelerating'
    WHEN COALESCE(SUM(ls.boxes_sold), 0) > 0 AND
         ROUND(COALESCE(SUM(ls.boxes_sold) FILTER (WHERE ls.finalized_at >= db.d14), 0)::numeric / 14.0, 2) <
         ROUND(COALESCE(SUM(ls.boxes_sold), 0)::numeric / 30.0, 2) * 0.85
    THEN 'declining'
    ELSE 'stable'
  END AS demand_trend
FROM line_sales ls
CROSS JOIN date_bounds db
GROUP BY ls.brand;

-- 2) Inventory Coverage Intelligence View
-- Joins production output (approved/sent boxes) with velocity + baseline
CREATE OR REPLACE VIEW v_inventory_coverage_intelligence AS
WITH finished_inventory AS (
  SELECT
    brand,
    SUM(COALESCE(boxes_produced, 0)) AS current_boxes_available
  FROM production_batches
  WHERE inventory_state IN ('approved', 'sent_to_office')
  GROUP BY brand
),
raw_inventory AS (
  SELECT
    SUM(COALESCE(quantity, 0)) AS total_raw_lbs
  FROM production_raw_materials
  WHERE material_type = 'tobacco' AND unit = 'lbs'
),
global_baseline AS (
  SELECT
    baseline_boxes_per_lb,
    baseline_lbs_per_box
  FROM production_conversion_baseline
  WHERE office_id IS NULL
  ORDER BY last_updated_at DESC
  LIMIT 1
)
SELECT
  sv.brand,
  COALESCE(fi.current_boxes_available, 0) AS current_boxes_available,
  sv.units_sold_last_7_days,
  sv.units_sold_last_14_days,
  sv.units_sold_last_30_days,
  sv.avg_daily_velocity_30d,
  sv.avg_daily_velocity_14d,
  sv.demand_trend,
  -- Days of inventory remaining
  CASE
    WHEN sv.avg_daily_velocity_30d > 0
    THEN ROUND(COALESCE(fi.current_boxes_available, 0)::numeric / sv.avg_daily_velocity_30d, 1)
    ELSE NULL
  END AS days_of_inventory_remaining,
  -- Risk level
  CASE
    WHEN sv.avg_daily_velocity_30d = 0 THEN 'no_demand'
    WHEN COALESCE(fi.current_boxes_available, 0)::numeric / NULLIF(sv.avg_daily_velocity_30d, 0) < 7 THEN 'critical'
    WHEN COALESCE(fi.current_boxes_available, 0)::numeric / NULLIF(sv.avg_daily_velocity_30d, 0) < 14 THEN 'red'
    WHEN COALESCE(fi.current_boxes_available, 0)::numeric / NULLIF(sv.avg_daily_velocity_30d, 0) <= 21 THEN 'amber'
    ELSE 'green'
  END AS risk_level,
  -- Production recommendation
  GREATEST(0, ROUND(
    (sv.avg_daily_velocity_30d * 30) - COALESCE(fi.current_boxes_available, 0)
  , 0)) AS required_boxes_for_30_days,
  -- LBS needed (using baseline)
  CASE
    WHEN gb.baseline_boxes_per_lb > 0 THEN
      ROUND(
        GREATEST(0, (sv.avg_daily_velocity_30d * 30) - COALESCE(fi.current_boxes_available, 0))
        / gb.baseline_boxes_per_lb * 1.10  -- 10% safety buffer
      , 1)
    ELSE NULL
  END AS recommended_lbs_to_produce,
  -- Raw material status
  COALESCE(ri.total_raw_lbs, 0) AS raw_inventory_lbs,
  CASE
    WHEN gb.baseline_boxes_per_lb > 0 THEN
      GREATEST(0, ROUND(
        (GREATEST(0, (sv.avg_daily_velocity_30d * 30) - COALESCE(fi.current_boxes_available, 0))
         / gb.baseline_boxes_per_lb * 1.10)
        - COALESCE(ri.total_raw_lbs, 0)
      , 1))
    ELSE NULL
  END AS procurement_needed_lbs,
  -- Overstock detection
  CASE
    WHEN sv.avg_daily_velocity_30d > 0 AND
         COALESCE(fi.current_boxes_available, 0)::numeric / sv.avg_daily_velocity_30d > 45
    THEN true
    ELSE false
  END AS is_overstock,
  -- Baseline reference
  gb.baseline_boxes_per_lb,
  gb.baseline_lbs_per_box
FROM v_sku_sales_velocity sv
LEFT JOIN finished_inventory fi ON fi.brand = sv.brand
CROSS JOIN raw_inventory ri
CROSS JOIN global_baseline gb;

-- 3) Production demand override audit table
CREATE TABLE IF NOT EXISTS production_demand_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  recommended_lbs numeric NOT NULL,
  actual_lbs numeric NOT NULL,
  deviation_pct numeric NOT NULL,
  override_reason text NOT NULL,
  acknowledged_by uuid REFERENCES auth.users(id),
  batch_id uuid REFERENCES production_batches(id),
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE production_demand_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read demand overrides"
  ON production_demand_overrides FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert demand overrides"
  ON production_demand_overrides FOR INSERT
  TO authenticated WITH CHECK (true);
