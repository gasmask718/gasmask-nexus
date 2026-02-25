
-- ============================================================
-- SUPERVISOR PERFORMANCE ENGINE — VIEWS + HISTORY TABLE
-- ============================================================

-- 1) Rolling 30-day supervisor performance view
CREATE OR REPLACE VIEW public.v_supervisor_30d_performance AS
WITH production_days AS (
  SELECT
    dps.office_id,
    dps.supervisor_user_id,
    dps.production_date,
    dps.workers_present,
    dps.boxes_completed,
    dps.tobacco_lbs_used,
    COALESCE(po.daily_box_goal, 100) AS daily_goal
  FROM public.daily_production_summary dps
  LEFT JOIN public.production_offices po ON po.id = dps.office_id
  WHERE dps.production_date >= (CURRENT_DATE - INTERVAL '30 days')
    AND dps.workers_present > 0
    AND dps.boxes_completed > 0
),
reopen_stats AS (
  SELECT
    pb.office_id,
    COUNT(*) FILTER (WHERE bsh.to_state = 'in_production' AND bsh.from_state = 'completed') AS reopened_count,
    COUNT(DISTINCT pb.id) AS total_completed
  FROM public.production_batches pb
  LEFT JOIN public.batch_state_history bsh ON bsh.batch_id = pb.id
  WHERE pb.created_at >= (CURRENT_DATE - INTERVAL '30 days')
    AND pb.status IN ('completed','approved','boxed')
  GROUP BY pb.office_id
),
material_baselines AS (
  SELECT
    office_id,
    AVG(CASE WHEN tobacco_lbs_used > 0 THEN boxes_completed::numeric / tobacco_lbs_used ELSE NULL END) AS baseline_boxes_per_lb
  FROM public.daily_production_summary
  WHERE production_date >= (CURRENT_DATE - INTERVAL '90 days')
    AND tobacco_lbs_used > 0
    AND boxes_completed > 0
  GROUP BY office_id
)
SELECT
  pd.office_id,
  pd.supervisor_user_id,
  COUNT(pd.production_date) AS total_days,
  COUNT(pd.production_date) FILTER (WHERE pd.boxes_completed >= pd.daily_goal) AS goal_hit_days,
  ROUND(
    (COUNT(pd.production_date) FILTER (WHERE pd.boxes_completed >= pd.daily_goal)::numeric
     / NULLIF(COUNT(pd.production_date), 0)) * 100, 1
  ) AS goal_completion_rate,
  ROUND(SUM(pd.boxes_completed)::numeric / NULLIF(SUM(pd.workers_present), 0), 1) AS avg_boxes_per_worker,
  COALESCE(
    ROUND(rs.reopened_count::numeric / NULLIF(rs.total_completed, 0) * 100, 1),
    0
  ) AS reopen_rate,
  ROUND(
    (AVG(CASE WHEN pd.tobacco_lbs_used > 0 THEN pd.boxes_completed::numeric / pd.tobacco_lbs_used ELSE NULL END)
     / NULLIF(mb.baseline_boxes_per_lb, 0)) - 1,
    3
  ) AS material_efficiency_delta,
  NOW() AS calculated_at
FROM production_days pd
LEFT JOIN reopen_stats rs ON rs.office_id = pd.office_id
LEFT JOIN material_baselines mb ON mb.office_id = pd.office_id
GROUP BY pd.office_id, pd.supervisor_user_id, rs.reopened_count, rs.total_completed, mb.baseline_boxes_per_lb;

-- 2) Supervisor rolling history snapshots table
CREATE TABLE IF NOT EXISTS public.supervisor_performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.production_offices(id),
  supervisor_user_id UUID,
  snapshot_month TEXT NOT NULL,
  total_days INT DEFAULT 0,
  goal_hit_days INT DEFAULT 0,
  goal_completion_rate NUMERIC DEFAULT 0,
  avg_boxes_per_worker NUMERIC DEFAULT 0,
  reopen_rate NUMERIC DEFAULT 0,
  material_efficiency_delta NUMERIC DEFAULT 0,
  goal_score NUMERIC DEFAULT 0,
  efficiency_score NUMERIC DEFAULT 0,
  reopen_score NUMERIC DEFAULT 0,
  material_score NUMERIC DEFAULT 0,
  composite_index NUMERIC DEFAULT 0,
  performance_version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.supervisor_performance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read supervisor snapshots"
  ON public.supervisor_performance_snapshots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert supervisor snapshots"
  ON public.supervisor_performance_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));
