
-- ============================================================
-- PROFIT PER POUND ENGINE — Schema Additions
-- ============================================================

-- 1) Add conversion & revenue snapshot fields to production_batches
ALTER TABLE public.production_batches
  ADD COLUMN IF NOT EXISTS tube_size TEXT,
  ADD COLUMN IF NOT EXISTS bag_weight_grams NUMERIC,
  ADD COLUMN IF NOT EXISTS conversion_boxes_per_lb_snapshot NUMERIC,
  ADD COLUMN IF NOT EXISTS wholesale_price_per_box_snapshot NUMERIC;

-- 2) Add profit-per-lb fields to batch_cost_history
ALTER TABLE public.batch_cost_history
  ADD COLUMN IF NOT EXISTS tube_size TEXT,
  ADD COLUMN IF NOT EXISTS bag_weight_grams NUMERIC,
  ADD COLUMN IF NOT EXISTS conversion_boxes_per_lb_snapshot NUMERIC,
  ADD COLUMN IF NOT EXISTS wholesale_price_per_box_snapshot NUMERIC,
  ADD COLUMN IF NOT EXISTS cost_per_lb NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_per_lb NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit_per_lb NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margin_pct NUMERIC DEFAULT 0;

-- 3) Create immutable profit_per_lb_snapshots table
CREATE TABLE IF NOT EXISTS public.profit_per_lb_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID REFERENCES public.production_batches(id),
  office_id UUID,
  product_type TEXT NOT NULL DEFAULT 'tubes',
  tube_size TEXT,
  bag_weight_grams NUMERIC,
  boxes_per_lb NUMERIC NOT NULL DEFAULT 0,
  cost_per_lb NUMERIC NOT NULL DEFAULT 0,
  revenue_per_lb NUMERIC NOT NULL DEFAULT 0,
  profit_per_lb NUMERIC NOT NULL DEFAULT 0,
  margin_pct NUMERIC NOT NULL DEFAULT 0,
  snapshot_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_immutable BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profit_per_lb_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read profit snapshots"
  ON public.profit_per_lb_snapshots FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert profit snapshots"
  ON public.profit_per_lb_snapshots FOR INSERT
  TO authenticated WITH CHECK (true);

-- 4) Create v_profit_per_lb_analysis view (latest version per batch only)
CREATE OR REPLACE VIEW public.v_profit_per_lb_analysis AS
WITH latest_versions AS (
  SELECT DISTINCT ON (batch_id) *
  FROM public.batch_cost_history
  ORDER BY batch_id, version DESC
)
SELECT
  lv.id,
  lv.batch_id,
  lv.office_id,
  lv.product_type,
  lv.tube_size,
  lv.bag_weight_grams,
  lv.boxes_produced,
  lv.cost_per_box,
  lv.total_batch_cost,
  lv.labor_cost,
  lv.labor_model,
  lv.conversion_boxes_per_lb_snapshot AS boxes_per_lb,
  lv.wholesale_price_per_box_snapshot,
  CASE WHEN COALESCE(lv.conversion_boxes_per_lb_snapshot, 0) > 0
    THEN lv.cost_per_box * lv.conversion_boxes_per_lb_snapshot
    ELSE 0 END AS cost_per_lb,
  CASE WHEN COALESCE(lv.conversion_boxes_per_lb_snapshot, 0) > 0 AND COALESCE(lv.wholesale_price_per_box_snapshot, 0) > 0
    THEN lv.wholesale_price_per_box_snapshot * lv.conversion_boxes_per_lb_snapshot
    ELSE 0 END AS revenue_per_lb,
  CASE WHEN COALESCE(lv.conversion_boxes_per_lb_snapshot, 0) > 0 AND COALESCE(lv.wholesale_price_per_box_snapshot, 0) > 0
    THEN (lv.wholesale_price_per_box_snapshot * lv.conversion_boxes_per_lb_snapshot) - (lv.cost_per_box * lv.conversion_boxes_per_lb_snapshot)
    ELSE 0 END AS profit_per_lb,
  CASE WHEN COALESCE(lv.conversion_boxes_per_lb_snapshot, 0) > 0 AND COALESCE(lv.wholesale_price_per_box_snapshot, 0) > 0
       AND (lv.wholesale_price_per_box_snapshot * lv.conversion_boxes_per_lb_snapshot) > 0
    THEN ROUND(
      ((lv.wholesale_price_per_box_snapshot * lv.conversion_boxes_per_lb_snapshot) - (lv.cost_per_box * lv.conversion_boxes_per_lb_snapshot))
      / (lv.wholesale_price_per_box_snapshot * lv.conversion_boxes_per_lb_snapshot) * 100, 2)
    ELSE 0 END AS margin_pct,
  lv.cost_snapshot_created_at,
  lv.version
FROM latest_versions lv;
