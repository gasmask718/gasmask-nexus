
-- 1. Create labor_model enum
CREATE TYPE public.labor_model AS ENUM ('hourly', 'per_box', 'flat_day');

-- 2. Add labor model fields to production_batches
ALTER TABLE public.production_batches
  ADD COLUMN labor_model public.labor_model DEFAULT NULL,
  ADD COLUMN worker_count INT DEFAULT 1,
  ADD COLUMN selected_worker_ids UUID[] DEFAULT NULL,
  ADD COLUMN labor_hourly_rate_snapshot NUMERIC DEFAULT NULL,
  ADD COLUMN labor_per_box_rate_snapshot NUMERIC DEFAULT NULL,
  ADD COLUMN labor_flat_day_rate_snapshot NUMERIC DEFAULT NULL;

-- 3. Add rate fields to production_workers
ALTER TABLE public.production_workers
  ADD COLUMN hourly_rate NUMERIC DEFAULT 15,
  ADD COLUMN per_box_rate NUMERIC DEFAULT 0,
  ADD COLUMN flat_day_rate NUMERIC DEFAULT 0;

-- 4. Add compensation_mode to labor_performance_snapshots (future hook, not active)
CREATE TYPE public.compensation_mode AS ENUM ('none', 'hourly', 'per_box', 'flat');

ALTER TABLE public.labor_performance_snapshots
  ADD COLUMN compensation_mode public.compensation_mode DEFAULT 'none';

-- 5. Create batch_cost_history ledger (immutable)
CREATE TABLE public.batch_cost_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.production_batches(id),
  office_id UUID REFERENCES public.production_offices(id),
  product_type TEXT NOT NULL DEFAULT 'tubes',
  boxes_produced NUMERIC DEFAULT 0,
  tobacco_cost NUMERIC DEFAULT 0,
  packaging_cost NUMERIC DEFAULT 0,
  labor_cost NUMERIC DEFAULT 0,
  overhead_cost NUMERIC DEFAULT 0,
  total_batch_cost NUMERIC DEFAULT 0,
  cost_per_box NUMERIC DEFAULT 0,
  labor_model public.labor_model DEFAULT NULL,
  worker_count INT DEFAULT 1,
  cost_snapshot_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by UUID DEFAULT NULL,
  is_immutable BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.batch_cost_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read batch_cost_history"
  ON public.batch_cost_history
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert batch_cost_history"
  ON public.batch_cost_history
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- No UPDATE or DELETE policies — immutable ledger

-- 6. Create v_batch_cost_summary view
CREATE OR REPLACE VIEW public.v_batch_cost_summary AS
SELECT
  bch.office_id,
  po.name AS office_name,
  bch.product_type,
  COUNT(*) AS batch_count,
  SUM(bch.total_batch_cost) AS total_cost,
  SUM(bch.labor_cost) AS total_labor_cost,
  SUM(bch.boxes_produced) AS total_boxes,
  CASE WHEN SUM(bch.boxes_produced) > 0 
    THEN ROUND(SUM(bch.total_batch_cost) / NULLIF(SUM(bch.boxes_produced), 0), 2) 
    ELSE 0 
  END AS avg_cost_per_box,
  CASE WHEN SUM(bch.total_batch_cost) > 0
    THEN ROUND(SUM(bch.labor_cost) / NULLIF(SUM(bch.total_batch_cost), 0) * 100, 1)
    ELSE 0
  END AS labor_pct_of_total,
  -- Rolling 30-day average cost per box
  (
    SELECT ROUND(SUM(r.total_batch_cost) / NULLIF(SUM(r.boxes_produced), 0), 2)
    FROM public.batch_cost_history r
    WHERE r.office_id = bch.office_id
      AND r.product_type = bch.product_type
      AND r.cost_snapshot_created_at >= NOW() - INTERVAL '30 days'
  ) AS rolling_30d_avg_cost_per_box
FROM public.batch_cost_history bch
LEFT JOIN public.production_offices po ON po.id = bch.office_id
GROUP BY bch.office_id, po.name, bch.product_type;
