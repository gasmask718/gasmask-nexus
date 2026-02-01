-- ============================================================
-- PRODUCTION INTELLIGENCE: COMPLETE SYSTEM UPGRADE
-- Includes: Cycle Benchmarks table, RLS, Auto-Calc, Worker Attribution
-- ============================================================

-- ============================================================
-- 1. CREATE CYCLE BENCHMARKS TABLE (was missing)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.production_cycle_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type text NOT NULL DEFAULT 'global' CHECK (scope_type IN ('global', 'office', 'brand')),
  scope_id uuid,
  brand text,
  expected_tube_fill_seconds numeric NOT NULL DEFAULT 8,
  expected_sticker_apply_seconds numeric NOT NULL DEFAULT 5,
  expected_batch_completion_minutes numeric NOT NULL DEFAULT 120,
  expected_boxes_per_hour numeric NOT NULL DEFAULT 10,
  variance_threshold_pct numeric NOT NULL DEFAULT 15,
  set_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.production_cycle_benchmarks ENABLE ROW LEVEL SECURITY;

-- Insert default global benchmark
INSERT INTO public.production_cycle_benchmarks (scope_type, expected_tube_fill_seconds, expected_sticker_apply_seconds, expected_batch_completion_minutes, expected_boxes_per_hour)
VALUES ('global', 8, 5, 120, 10)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. ADD WORKER ATTRIBUTION TO OUTPUTS
-- ============================================================
ALTER TABLE public.production_batch_outputs 
ADD COLUMN IF NOT EXISTS worker_id uuid REFERENCES public.production_workers(id),
ADD COLUMN IF NOT EXISTS sticker_worker_id uuid REFERENCES public.production_workers(id),
ADD COLUMN IF NOT EXISTS fill_worker_id uuid REFERENCES public.production_workers(id),
ADD COLUMN IF NOT EXISTS tube_fill_seconds numeric,
ADD COLUMN IF NOT EXISTS sticker_apply_seconds numeric,
ADD COLUMN IF NOT EXISTS defect_category text;

-- ============================================================
-- 3. CREATE SECURITY DEFINER FUNCTIONS FOR RLS
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_production_elevated_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('owner', 'admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_office_manager(_user_id uuid, _office_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.production_office_users
    WHERE user_id = _user_id
    AND office_id = _office_id
    AND role IN ('manager', 'supervisor')
  )
$$;

CREATE OR REPLACE FUNCTION public.get_managed_office_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT office_id FROM public.production_office_users
  WHERE user_id = _user_id
  AND role IN ('manager', 'supervisor')
$$;

CREATE OR REPLACE FUNCTION public.can_access_office(_user_id uuid, _office_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.has_production_elevated_role(_user_id)
    OR public.is_office_manager(_user_id, _office_id)
$$;

-- ============================================================
-- 4. STRICT RLS POLICIES FOR SKILL PROFILES
-- ============================================================

DROP POLICY IF EXISTS "Enable read for authenticated" ON public.production_worker_skill_profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.production_worker_skill_profiles;
DROP POLICY IF EXISTS "Enable update for authenticated" ON public.production_worker_skill_profiles;
DROP POLICY IF EXISTS "Enable delete for authenticated" ON public.production_worker_skill_profiles;
DROP POLICY IF EXISTS "skill_profiles_select" ON public.production_worker_skill_profiles;
DROP POLICY IF EXISTS "skill_profiles_insert" ON public.production_worker_skill_profiles;
DROP POLICY IF EXISTS "skill_profiles_update" ON public.production_worker_skill_profiles;
DROP POLICY IF EXISTS "skill_profiles_elevated_read" ON public.production_worker_skill_profiles;
DROP POLICY IF EXISTS "skill_profiles_elevated_insert" ON public.production_worker_skill_profiles;
DROP POLICY IF EXISTS "skill_profiles_elevated_update" ON public.production_worker_skill_profiles;

CREATE POLICY "skill_profiles_elevated_read" 
ON public.production_worker_skill_profiles
FOR SELECT TO authenticated
USING (
  public.has_production_elevated_role(auth.uid())
  OR public.can_access_office(auth.uid(), office_id)
);

CREATE POLICY "skill_profiles_elevated_insert" 
ON public.production_worker_skill_profiles
FOR INSERT TO authenticated
WITH CHECK (
  public.has_production_elevated_role(auth.uid())
  OR public.can_access_office(auth.uid(), office_id)
);

CREATE POLICY "skill_profiles_elevated_update" 
ON public.production_worker_skill_profiles
FOR UPDATE TO authenticated
USING (
  public.has_production_elevated_role(auth.uid())
  OR public.can_access_office(auth.uid(), office_id)
);

-- ============================================================
-- 5. STRICT RLS POLICIES FOR PERFORMANCE SNAPSHOTS
-- ============================================================

DROP POLICY IF EXISTS "Enable read for authenticated" ON public.production_worker_performance_snapshots;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.production_worker_performance_snapshots;
DROP POLICY IF EXISTS "Enable update for authenticated" ON public.production_worker_performance_snapshots;
DROP POLICY IF EXISTS "snapshots_select" ON public.production_worker_performance_snapshots;
DROP POLICY IF EXISTS "snapshots_insert" ON public.production_worker_performance_snapshots;
DROP POLICY IF EXISTS "snapshots_update" ON public.production_worker_performance_snapshots;
DROP POLICY IF EXISTS "snapshots_elevated_read" ON public.production_worker_performance_snapshots;
DROP POLICY IF EXISTS "snapshots_elevated_insert" ON public.production_worker_performance_snapshots;
DROP POLICY IF EXISTS "snapshots_elevated_update" ON public.production_worker_performance_snapshots;

CREATE POLICY "snapshots_elevated_read" 
ON public.production_worker_performance_snapshots
FOR SELECT TO authenticated
USING (
  public.has_production_elevated_role(auth.uid())
  OR public.can_access_office(auth.uid(), office_id)
);

CREATE POLICY "snapshots_elevated_insert" 
ON public.production_worker_performance_snapshots
FOR INSERT TO authenticated
WITH CHECK (
  public.has_production_elevated_role(auth.uid())
  OR public.can_access_office(auth.uid(), office_id)
);

CREATE POLICY "snapshots_elevated_update" 
ON public.production_worker_performance_snapshots
FOR UPDATE TO authenticated
USING (
  public.has_production_elevated_role(auth.uid())
  OR public.can_access_office(auth.uid(), office_id)
);

-- ============================================================
-- 6. RLS POLICIES FOR CYCLE BENCHMARKS
-- ============================================================

CREATE POLICY "benchmarks_elevated_read" 
ON public.production_cycle_benchmarks
FOR SELECT TO authenticated
USING (
  public.has_production_elevated_role(auth.uid())
  OR (scope_type = 'office' AND public.can_access_office(auth.uid(), scope_id))
  OR scope_type = 'global'
);

CREATE POLICY "benchmarks_elevated_insert" 
ON public.production_cycle_benchmarks
FOR INSERT TO authenticated
WITH CHECK (public.has_production_elevated_role(auth.uid()));

CREATE POLICY "benchmarks_elevated_update" 
ON public.production_cycle_benchmarks
FOR UPDATE TO authenticated
USING (public.has_production_elevated_role(auth.uid()));

CREATE POLICY "benchmarks_elevated_delete" 
ON public.production_cycle_benchmarks
FOR DELETE TO authenticated
USING (public.has_production_elevated_role(auth.uid()));

-- ============================================================
-- 7. AUTO-CALCULATION FUNCTION FOR SKILL PROFILES
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalculate_worker_skill_profiles(
  p_office_id uuid,
  p_for_date date DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker record;
  v_7d_start date := p_for_date - INTERVAL '7 days';
  v_30d_start date := p_for_date - INTERVAL '30 days';
  v_90d_start date := p_for_date - INTERVAL '90 days';
  v_profile_data record;
  v_speed_score integer;
  v_quality_score integer;
  v_reliability_score integer;
  v_overall_score integer;
BEGIN
  FOR v_worker IN 
    SELECT id FROM production_workers 
    WHERE office_id = p_office_id AND status = 'active'
  LOOP
    -- Upsert daily snapshot
    INSERT INTO production_worker_performance_snapshots (
      worker_id, office_id, snapshot_date,
      batches_participated, boxes_produced, tubes_filled,
      stickers_applied, defects_count, defect_rate,
      hours_worked, avg_tube_fill_seconds, avg_sticker_apply_seconds, boxes_per_hour
    )
    SELECT 
      v_worker.id, p_office_id, p_for_date,
      COUNT(DISTINCT bo.batch_id),
      COALESCE(SUM(bo.boxes_completed), 0),
      COALESCE(SUM(bo.tubes_used), 0),
      COALESCE(SUM(bo.stickers_used), 0),
      COALESCE(SUM(bo.defects_count), 0),
      CASE WHEN SUM(bo.tubes_used) > 0 
        THEN (SUM(bo.defects_count)::numeric / SUM(bo.tubes_used) * 1000) ELSE 0 END,
      COALESCE((SELECT SUM(a.hours_worked) FROM production_worker_attendance a
        WHERE a.worker_id = v_worker.id AND a.attendance_date = p_for_date), 0),
      AVG(bo.tube_fill_seconds),
      AVG(bo.sticker_apply_seconds),
      CASE WHEN (SELECT COALESCE(SUM(a.hours_worked), 0) FROM production_worker_attendance a
        WHERE a.worker_id = v_worker.id AND a.attendance_date = p_for_date) > 0 THEN
        COALESCE(SUM(bo.boxes_completed), 0)::numeric / NULLIF((SELECT SUM(a.hours_worked)
          FROM production_worker_attendance a WHERE a.worker_id = v_worker.id AND a.attendance_date = p_for_date), 0)
      ELSE 0 END
    FROM production_batch_outputs bo
    JOIN production_batches b ON b.id = bo.batch_id
    WHERE bo.worker_id = v_worker.id AND b.batch_date = p_for_date
    GROUP BY v_worker.id
    ON CONFLICT (worker_id, office_id, snapshot_date) DO UPDATE SET
      batches_participated = EXCLUDED.batches_participated,
      boxes_produced = EXCLUDED.boxes_produced,
      tubes_filled = EXCLUDED.tubes_filled,
      stickers_applied = EXCLUDED.stickers_applied,
      defects_count = EXCLUDED.defects_count,
      defect_rate = EXCLUDED.defect_rate,
      hours_worked = EXCLUDED.hours_worked,
      avg_tube_fill_seconds = EXCLUDED.avg_tube_fill_seconds,
      avg_sticker_apply_seconds = EXCLUDED.avg_sticker_apply_seconds,
      boxes_per_hour = EXCLUDED.boxes_per_hour;

    -- Calculate rolling aggregates
    SELECT 
      COALESCE(SUM(CASE WHEN snapshot_date >= v_7d_start THEN boxes_produced ELSE 0 END), 0) as r7_boxes,
      COALESCE(SUM(CASE WHEN snapshot_date >= v_7d_start THEN defects_count ELSE 0 END), 0) as r7_defects,
      COALESCE(SUM(CASE WHEN snapshot_date >= v_7d_start THEN hours_worked ELSE 0 END), 0) as r7_hours,
      COALESCE(SUM(CASE WHEN snapshot_date >= v_30d_start THEN boxes_produced ELSE 0 END), 0) as r30_boxes,
      COALESCE(SUM(CASE WHEN snapshot_date >= v_30d_start THEN defects_count ELSE 0 END), 0) as r30_defects,
      COALESCE(SUM(CASE WHEN snapshot_date >= v_30d_start THEN hours_worked ELSE 0 END), 0) as r30_hours,
      COALESCE(SUM(boxes_produced), 0) as r90_boxes,
      COALESCE(SUM(defects_count), 0) as r90_defects,
      COALESCE(SUM(hours_worked), 0) as r90_hours,
      AVG(avg_tube_fill_seconds) as avg_tube_fill,
      AVG(avg_sticker_apply_seconds) as avg_sticker,
      COUNT(CASE WHEN snapshot_date >= v_7d_start AND hours_worked > 0 THEN 1 END)::numeric 
        / NULLIF(COUNT(CASE WHEN snapshot_date >= v_7d_start THEN 1 END), 0) * 100 as attend_7d,
      COUNT(CASE WHEN snapshot_date >= v_30d_start AND hours_worked > 0 THEN 1 END)::numeric 
        / NULLIF(COUNT(CASE WHEN snapshot_date >= v_30d_start THEN 1 END), 0) * 100 as attend_30d
    INTO v_profile_data
    FROM production_worker_performance_snapshots
    WHERE worker_id = v_worker.id AND office_id = p_office_id AND snapshot_date >= v_90d_start;

    -- Calculate scores
    v_speed_score := LEAST(100, GREATEST(0, 
      CASE WHEN COALESCE(v_profile_data.r7_hours, 0) > 0 
        THEN ROUND((v_profile_data.r7_boxes / v_profile_data.r7_hours / 10) * 100) ELSE 50 END));
    v_quality_score := LEAST(100, GREATEST(0,
      100 - CASE WHEN COALESCE(v_profile_data.r30_boxes, 0) > 0 
        THEN ROUND((v_profile_data.r30_defects::numeric / v_profile_data.r30_boxes) * 1000) ELSE 0 END));
    v_reliability_score := COALESCE(ROUND(v_profile_data.attend_30d), 50);
    v_overall_score := ROUND(v_speed_score * 0.3 + v_quality_score * 0.5 + v_reliability_score * 0.2);

    -- Upsert skill profile
    INSERT INTO production_worker_skill_profiles (
      worker_id, office_id, avg_tube_fill_seconds, avg_sticker_apply_seconds,
      defect_rate_per_thousand, boxes_per_hour,
      rolling_7_day_boxes, rolling_7_day_defects, rolling_7_day_hours,
      rolling_30_day_boxes, rolling_30_day_defects, rolling_30_day_hours,
      rolling_90_day_boxes, rolling_90_day_defects, rolling_90_day_hours,
      attendance_rate_7d, attendance_rate_30d, trend_speed, trend_quality,
      speed_score, quality_score, reliability_score, overall_score, last_calculated_at
    ) VALUES (
      v_worker.id, p_office_id, v_profile_data.avg_tube_fill, v_profile_data.avg_sticker,
      CASE WHEN COALESCE(v_profile_data.r30_boxes, 0) > 0 
        THEN (v_profile_data.r30_defects::numeric / v_profile_data.r30_boxes * 1000) ELSE 0 END,
      CASE WHEN COALESCE(v_profile_data.r7_hours, 0) > 0 
        THEN v_profile_data.r7_boxes / v_profile_data.r7_hours ELSE 0 END,
      COALESCE(v_profile_data.r7_boxes, 0), COALESCE(v_profile_data.r7_defects, 0), COALESCE(v_profile_data.r7_hours, 0),
      COALESCE(v_profile_data.r30_boxes, 0), COALESCE(v_profile_data.r30_defects, 0), COALESCE(v_profile_data.r30_hours, 0),
      COALESCE(v_profile_data.r90_boxes, 0), COALESCE(v_profile_data.r90_defects, 0), COALESCE(v_profile_data.r90_hours, 0),
      v_profile_data.attend_7d, v_profile_data.attend_30d, 'stable', 'stable',
      v_speed_score, v_quality_score, v_reliability_score, v_overall_score, now()
    )
    ON CONFLICT (worker_id, office_id) DO UPDATE SET
      avg_tube_fill_seconds = EXCLUDED.avg_tube_fill_seconds,
      avg_sticker_apply_seconds = EXCLUDED.avg_sticker_apply_seconds,
      defect_rate_per_thousand = EXCLUDED.defect_rate_per_thousand,
      boxes_per_hour = EXCLUDED.boxes_per_hour,
      rolling_7_day_boxes = EXCLUDED.rolling_7_day_boxes,
      rolling_7_day_defects = EXCLUDED.rolling_7_day_defects,
      rolling_7_day_hours = EXCLUDED.rolling_7_day_hours,
      rolling_30_day_boxes = EXCLUDED.rolling_30_day_boxes,
      rolling_30_day_defects = EXCLUDED.rolling_30_day_defects,
      rolling_30_day_hours = EXCLUDED.rolling_30_day_hours,
      rolling_90_day_boxes = EXCLUDED.rolling_90_day_boxes,
      rolling_90_day_defects = EXCLUDED.rolling_90_day_defects,
      rolling_90_day_hours = EXCLUDED.rolling_90_day_hours,
      attendance_rate_7d = EXCLUDED.attendance_rate_7d,
      attendance_rate_30d = EXCLUDED.attendance_rate_30d,
      speed_score = EXCLUDED.speed_score,
      quality_score = EXCLUDED.quality_score,
      reliability_score = EXCLUDED.reliability_score,
      overall_score = EXCLUDED.overall_score,
      last_calculated_at = EXCLUDED.last_calculated_at,
      updated_at = now();
  END LOOP;
END;
$$;

-- ============================================================
-- 8. TRIGGER TO AUTO-RECALCULATE ON OUTPUT RECORDED
-- ============================================================

CREATE OR REPLACE FUNCTION public.trigger_recalculate_skill_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office_id uuid;
  v_batch_date date;
BEGIN
  SELECT b.office_id, b.batch_date INTO v_office_id, v_batch_date
  FROM production_batches b WHERE b.id = NEW.batch_id;
  
  IF v_office_id IS NOT NULL THEN
    PERFORM public.recalculate_worker_skill_profiles(v_office_id, COALESCE(v_batch_date, CURRENT_DATE));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_output_recalc_skills ON public.production_batch_outputs;
CREATE TRIGGER trigger_output_recalc_skills
  AFTER INSERT OR UPDATE ON public.production_batch_outputs
  FOR EACH ROW WHEN (NEW.worker_id IS NOT NULL)
  EXECUTE FUNCTION public.trigger_recalculate_skill_profiles();

-- ============================================================
-- 9. INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_batches_office_date ON public.production_batches(office_id, batch_date DESC);
CREATE INDEX IF NOT EXISTS idx_outputs_worker ON public.production_batch_outputs(worker_id);
CREATE INDEX IF NOT EXISTS idx_outputs_batch ON public.production_batch_outputs(batch_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_worker_date ON public.production_worker_performance_snapshots(worker_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_skill_profiles_office ON public.production_worker_skill_profiles(office_id);

-- Unique constraints for upserts
DO $$
BEGIN
  ALTER TABLE public.production_worker_performance_snapshots 
    ADD CONSTRAINT snapshots_worker_office_date_unique UNIQUE (worker_id, office_id, snapshot_date);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.production_worker_skill_profiles 
    ADD CONSTRAINT skill_profiles_worker_office_unique UNIQUE (worker_id, office_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;