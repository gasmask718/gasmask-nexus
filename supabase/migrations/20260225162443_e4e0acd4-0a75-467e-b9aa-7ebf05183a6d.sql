
-- Step 1: Add supplier link to production_batches
ALTER TABLE public.production_batches
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id),
  ADD COLUMN IF NOT EXISTS supplier_batch_reference TEXT;

-- Step 2: Create index for efficient joins
CREATE INDEX IF NOT EXISTS idx_production_batches_supplier_id
  ON public.production_batches(supplier_id);

-- Step 3: Create the Supplier Yield Intelligence view
CREATE OR REPLACE VIEW public.v_supplier_yield_intelligence AS
WITH batch_data AS (
  SELECT
    pb.supplier_id,
    s.name AS supplier_name,
    pb.tobacco_lbs,
    pb.boxes_produced,
    pb.waste_lbs,
    pb.batch_date,
    pb.office_id,
    pb.status,
    pb.inventory_state,
    -- Conversion ratios
    CASE WHEN pb.tobacco_lbs > 0 AND pb.boxes_produced > 0
      THEN pb.boxes_produced::numeric / pb.tobacco_lbs
      ELSE NULL END AS boxes_per_lb,
    CASE WHEN pb.boxes_produced > 0 AND pb.tobacco_lbs > 0
      THEN pb.tobacco_lbs / pb.boxes_produced::numeric
      ELSE NULL END AS lbs_per_box,
    -- Waste pct
    CASE WHEN pb.tobacco_lbs > 0 AND pb.waste_lbs IS NOT NULL
      THEN ROUND((pb.waste_lbs / pb.tobacco_lbs * 100)::numeric, 2)
      ELSE 0 END AS waste_pct
  FROM public.production_batches pb
  JOIN public.suppliers s ON s.id = pb.supplier_id
  WHERE pb.supplier_id IS NOT NULL
    AND pb.tobacco_lbs > 0
    AND pb.boxes_produced > 0
    AND pb.status IN ('approved', 'completed')
),
global_baseline AS (
  SELECT
    COALESCE(AVG(boxes_per_lb), 0) AS global_avg_boxes_per_lb
  FROM batch_data
),
supplier_agg AS (
  SELECT
    bd.supplier_id,
    bd.supplier_name,
    SUM(bd.tobacco_lbs) AS total_lbs_supplied,
    SUM(bd.boxes_produced) AS total_boxes_produced,
    ROUND(AVG(bd.boxes_per_lb)::numeric, 4) AS avg_boxes_per_lb,
    ROUND(AVG(bd.lbs_per_box)::numeric, 4) AS avg_lbs_per_box,
    ROUND(AVG(bd.waste_pct)::numeric, 2) AS avg_waste_pct,
    COUNT(*) AS batch_count,
    -- Variance frequency: % of batches deviating > 5% from supplier mean
    ROUND(
      (COUNT(*) FILTER (
        WHERE ABS(bd.boxes_per_lb - (SELECT AVG(b2.boxes_per_lb) FROM batch_data b2 WHERE b2.supplier_id = bd.supplier_id)) 
              / NULLIF((SELECT AVG(b2.boxes_per_lb) FROM batch_data b2 WHERE b2.supplier_id = bd.supplier_id), 0) > 0.05
      )::numeric / NULLIF(COUNT(*), 0) * 100)::numeric, 1
    ) AS variance_frequency,
    -- Yield stability score: inverse of stddev (higher = more stable)
    CASE WHEN STDDEV(bd.boxes_per_lb) > 0
      THEN ROUND((1.0 / STDDEV(bd.boxes_per_lb) * 10)::numeric, 2)
      ELSE 100 END AS yield_stability_score,
    STDDEV(bd.boxes_per_lb) AS stddev_boxes_per_lb,
    -- Recent 30-day performance
    ROUND(AVG(bd.boxes_per_lb) FILTER (WHERE bd.batch_date >= CURRENT_DATE - INTERVAL '30 days')::numeric, 4) AS avg_boxes_per_lb_30d,
    COUNT(*) FILTER (WHERE bd.batch_date >= CURRENT_DATE - INTERVAL '30 days') AS batch_count_30d,
    MIN(bd.batch_date) AS first_batch_date,
    MAX(bd.batch_date) AS last_batch_date
  FROM batch_data bd
  GROUP BY bd.supplier_id, bd.supplier_name
)
SELECT
  sa.*,
  gb.global_avg_boxes_per_lb,
  -- Efficiency Score (0-100): weighted composite
  GREATEST(0, LEAST(100, ROUND(
    (
      -- Weight 1: Yield advantage vs global baseline (50 weight)
      50.0 * CASE WHEN gb.global_avg_boxes_per_lb > 0
        THEN sa.avg_boxes_per_lb / gb.global_avg_boxes_per_lb
        ELSE 1 END
      -- Weight 2: Waste penalty (25 weight, lower waste = higher score)
      - 25.0 * (sa.avg_waste_pct / NULLIF(GREATEST(sa.avg_waste_pct, 10), 0))
      -- Weight 3: Variance penalty (25 weight, lower variance freq = higher score)
      - 25.0 * (sa.variance_frequency / 100.0)
    )::numeric, 1
  ))) AS efficiency_score,
  -- Baseline comparison band
  CASE
    WHEN sa.avg_boxes_per_lb > gb.global_avg_boxes_per_lb THEN 'above'
    WHEN ABS(sa.avg_boxes_per_lb - gb.global_avg_boxes_per_lb) / NULLIF(gb.global_avg_boxes_per_lb, 0) <= 0.03 THEN 'within'
    ELSE 'below'
  END AS baseline_band,
  -- Trend direction (30d vs lifetime)
  CASE
    WHEN sa.avg_boxes_per_lb_30d IS NULL THEN 'no_data'
    WHEN sa.avg_boxes_per_lb_30d > sa.avg_boxes_per_lb THEN 'improving'
    WHEN sa.avg_boxes_per_lb_30d < sa.avg_boxes_per_lb * 0.97 THEN 'declining'
    ELSE 'stable'
  END AS trend_direction,
  RANK() OVER (ORDER BY sa.avg_boxes_per_lb DESC) AS yield_rank
FROM supplier_agg sa
CROSS JOIN global_baseline gb
ORDER BY sa.avg_boxes_per_lb DESC;
