-- ============================================================
-- WORKER SKILL PROFILES & CAPABILITY MODELING (COMPLETE)
-- ============================================================

-- Worker Skill Profile table (aggregated metrics)
CREATE TABLE IF NOT EXISTS public.production_worker_skill_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.production_workers(id) ON DELETE CASCADE,
  office_id UUID REFERENCES public.production_offices(id) ON DELETE SET NULL,
  
  -- Calculated metrics (rolling averages)
  avg_tube_fill_seconds NUMERIC(10,2) DEFAULT NULL,
  avg_sticker_apply_seconds NUMERIC(10,2) DEFAULT NULL,
  defect_rate_per_thousand NUMERIC(10,2) DEFAULT NULL,
  boxes_per_hour NUMERIC(10,2) DEFAULT NULL,
  
  -- Rolling periods
  rolling_7_day_boxes INTEGER DEFAULT 0,
  rolling_7_day_defects INTEGER DEFAULT 0,
  rolling_7_day_hours NUMERIC(10,2) DEFAULT 0,
  rolling_30_day_boxes INTEGER DEFAULT 0,
  rolling_30_day_defects INTEGER DEFAULT 0,
  rolling_30_day_hours NUMERIC(10,2) DEFAULT 0,
  rolling_90_day_boxes INTEGER DEFAULT 0,
  rolling_90_day_defects INTEGER DEFAULT 0,
  rolling_90_day_hours NUMERIC(10,2) DEFAULT 0,
  
  -- Attendance consistency
  attendance_rate_7d NUMERIC(5,2) DEFAULT NULL,
  attendance_rate_30d NUMERIC(5,2) DEFAULT NULL,
  
  -- Trend indicators
  trend_speed TEXT CHECK (trend_speed IN ('improving', 'stable', 'declining')) DEFAULT 'stable',
  trend_quality TEXT CHECK (trend_quality IN ('improving', 'stable', 'declining')) DEFAULT 'stable',
  
  -- Skill ratings (0-100)
  speed_score INTEGER DEFAULT 50 CHECK (speed_score >= 0 AND speed_score <= 100),
  quality_score INTEGER DEFAULT 50 CHECK (quality_score >= 0 AND quality_score <= 100),
  reliability_score INTEGER DEFAULT 50 CHECK (reliability_score >= 0 AND reliability_score <= 100),
  overall_score INTEGER DEFAULT 50 CHECK (overall_score >= 0 AND overall_score <= 100),
  
  -- Metadata
  last_calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(worker_id, office_id)
);

-- Enable RLS
ALTER TABLE public.production_worker_skill_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "skill_profiles_select" ON public.production_worker_skill_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "skill_profiles_insert" ON public.production_worker_skill_profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "skill_profiles_update" ON public.production_worker_skill_profiles FOR UPDATE TO authenticated USING (true);

-- Worker Performance Snapshot (for historical tracking)
CREATE TABLE IF NOT EXISTS public.production_worker_performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.production_workers(id) ON DELETE CASCADE,
  office_id UUID REFERENCES public.production_offices(id) ON DELETE SET NULL,
  snapshot_date DATE NOT NULL,
  
  -- Batch participation
  batches_participated INTEGER DEFAULT 0,
  
  -- Output metrics
  boxes_produced INTEGER DEFAULT 0,
  tubes_filled INTEGER DEFAULT 0,
  stickers_applied INTEGER DEFAULT 0,
  
  -- Quality metrics
  defects_count INTEGER DEFAULT 0,
  defect_rate NUMERIC(5,2) DEFAULT NULL,
  
  -- Time metrics
  hours_worked NUMERIC(10,2) DEFAULT NULL,
  avg_tube_fill_seconds NUMERIC(10,2) DEFAULT NULL,
  avg_sticker_apply_seconds NUMERIC(10,2) DEFAULT NULL,
  
  -- Efficiency
  boxes_per_hour NUMERIC(10,2) DEFAULT NULL,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(worker_id, office_id, snapshot_date)
);

-- Enable RLS
ALTER TABLE public.production_worker_performance_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "perf_snapshots_select" ON public.production_worker_performance_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "perf_snapshots_insert" ON public.production_worker_performance_snapshots FOR INSERT TO authenticated WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_worker_skill_profiles_worker ON public.production_worker_skill_profiles(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_skill_profiles_office ON public.production_worker_skill_profiles(office_id);
CREATE INDEX IF NOT EXISTS idx_worker_performance_snapshots_worker_date ON public.production_worker_performance_snapshots(worker_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_worker_performance_snapshots_office ON public.production_worker_performance_snapshots(office_id);

-- Add expected_* columns to production_batches for cycle time tracking
ALTER TABLE public.production_batches 
ADD COLUMN IF NOT EXISTS expected_completion_minutes NUMERIC(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS actual_completion_minutes NUMERIC(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cycle_time_variance_pct NUMERIC(5,2) DEFAULT NULL;