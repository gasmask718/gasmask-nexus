-- ============================================
-- MASTER PROMPT #8: Recalculation Observability & Health
-- MASTER PROMPT #9: Profile Versioning & Locking
-- ============================================

-- Drop existing function first (return type change)
DROP FUNCTION IF EXISTS public.process_recalc_queue();

-- ============================================
-- PART 1: Extend Recalculation Queue for Observability
-- ============================================

-- Add observability columns to recalc queue
ALTER TABLE public.production_recalc_queue
ADD COLUMN IF NOT EXISTS started_at timestamptz,
ADD COLUMN IF NOT EXISTS duration_ms integer,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS error_message text,
ADD COLUMN IF NOT EXISTS worker_count integer,
ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;

-- Add constraint separately to avoid issues
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'production_recalc_queue_status_check'
  ) THEN
    ALTER TABLE public.production_recalc_queue 
    ADD CONSTRAINT production_recalc_queue_status_check 
    CHECK (status IN ('pending', 'processing', 'success', 'failed'));
  END IF;
END $$;

-- Index for queue health queries
CREATE INDEX IF NOT EXISTS idx_recalc_queue_status ON public.production_recalc_queue(status);
CREATE INDEX IF NOT EXISTS idx_recalc_queue_requested_at ON public.production_recalc_queue(requested_at);

-- ============================================
-- PART 2: Profile Locking & Versioning
-- ============================================

-- Add locking columns to skill profiles
ALTER TABLE public.production_worker_skill_profiles
ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS locked_at timestamptz,
ADD COLUMN IF NOT EXISTS locked_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS lock_reason text,
ADD COLUMN IF NOT EXISTS calculation_version integer DEFAULT 1;

-- Add snapshot locking
ALTER TABLE public.production_worker_performance_snapshots
ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS locked_at timestamptz;

-- ============================================
-- PART 3: Updated Process Queue with Observability
-- ============================================

CREATE OR REPLACE FUNCTION public.process_recalc_queue()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_processed integer := 0;
  v_failed integer := 0;
  v_start_time timestamptz;
  v_duration_ms integer;
  v_worker_count integer;
BEGIN
  FOR v_item IN 
    SELECT id, office_id, batch_date
    FROM production_recalc_queue
    WHERE status = 'pending'
    ORDER BY requested_at
    LIMIT 50
    FOR UPDATE SKIP LOCKED
  LOOP
    v_start_time := clock_timestamp();
    
    UPDATE production_recalc_queue 
    SET status = 'processing', started_at = v_start_time
    WHERE id = v_item.id;
    
    BEGIN
      PERFORM recalculate_worker_skill_profiles(v_item.office_id, v_item.batch_date);
      
      SELECT COUNT(*) INTO v_worker_count
      FROM production_workers pw
      WHERE pw.office_id = v_item.office_id AND pw.is_active = true;
      
      v_duration_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time))::integer;
      
      UPDATE production_recalc_queue 
      SET status = 'success',
          processed_at = now(),
          duration_ms = v_duration_ms,
          worker_count = v_worker_count,
          error_message = NULL
      WHERE id = v_item.id;
      
      v_processed := v_processed + 1;
      
    EXCEPTION WHEN OTHERS THEN
      v_duration_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time))::integer;
      
      UPDATE production_recalc_queue 
      SET status = 'failed',
          processed_at = now(),
          duration_ms = v_duration_ms,
          error_message = SQLERRM,
          retry_count = COALESCE(retry_count, 0) + 1
      WHERE id = v_item.id;
      
      v_failed := v_failed + 1;
    END;
  END LOOP;
  
  RETURN jsonb_build_object('processed', v_processed, 'failed', v_failed, 'timestamp', now());
END;
$$;

-- ============================================
-- PART 4: Queue Health View
-- ============================================

CREATE OR REPLACE VIEW public.v_recalc_queue_health AS
SELECT
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
  COUNT(*) FILTER (WHERE status = 'processing') AS processing_count,
  COUNT(*) FILTER (WHERE status = 'success' AND processed_at > now() - interval '24 hours') AS success_24h,
  COUNT(*) FILTER (WHERE status = 'failed' AND processed_at > now() - interval '24 hours') AS failed_24h,
  ROUND(AVG(duration_ms) FILTER (WHERE status = 'success' AND processed_at > now() - interval '24 hours'))::integer AS avg_duration_ms_24h,
  MAX(duration_ms) FILTER (WHERE status = 'success' AND processed_at > now() - interval '24 hours') AS max_duration_ms_24h,
  EXTRACT(EPOCH FROM (now() - MIN(requested_at) FILTER (WHERE status = 'pending')))::integer AS oldest_pending_seconds,
  CASE 
    WHEN COUNT(*) FILTER (WHERE processed_at > now() - interval '24 hours') > 0 THEN
      ROUND(
        (COUNT(*) FILTER (WHERE status = 'failed' AND processed_at > now() - interval '24 hours')::numeric /
         COUNT(*) FILTER (WHERE processed_at > now() - interval '24 hours')::numeric) * 100, 2
      )
    ELSE 0
  END AS error_rate_24h,
  CASE
    WHEN COUNT(*) FILTER (WHERE status = 'pending') > 100 THEN 'critical'
    WHEN COUNT(*) FILTER (WHERE status = 'pending') > 50 THEN 'warning'
    WHEN COUNT(*) FILTER (WHERE status = 'failed' AND processed_at > now() - interval '1 hour') > 5 THEN 'degraded'
    ELSE 'healthy'
  END AS health_status,
  now() AS checked_at
FROM production_recalc_queue;

-- ============================================
-- PART 5: Auto-Lock Function
-- ============================================

CREATE OR REPLACE FUNCTION public.auto_lock_old_profiles(p_days_old integer DEFAULT 2)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked_count integer;
BEGIN
  WITH to_lock AS (
    UPDATE production_worker_skill_profiles
    SET is_locked = true,
        locked_at = now(),
        lock_reason = 'Auto-locked after ' || p_days_old || ' days'
    WHERE is_locked = false
      AND updated_at < now() - (p_days_old || ' days')::interval
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_locked_count FROM to_lock;
  
  UPDATE production_worker_performance_snapshots
  SET is_locked = true, locked_at = now()
  WHERE is_locked = false
    AND snapshot_date < current_date - p_days_old;
  
  RETURN v_locked_count;
END;
$$;

-- ============================================
-- PART 6: Updated Recalculation with Lock Check
-- ============================================

CREATE OR REPLACE FUNCTION public.recalculate_worker_skill_profiles(
  p_office_id uuid,
  p_for_date date DEFAULT current_date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker RECORD;
  v_stats RECORD;
  v_prev_stats RECORD;
  v_speed_score integer;
  v_quality_score integer;
  v_reliability_score integer;
  v_overall_score integer;
  v_trend_speed text;
  v_trend_quality text;
  v_trend_reliability text;
  v_speed_delta numeric;
  v_quality_delta numeric;
  v_reliability_delta numeric;
  v_profile_locked boolean;
BEGIN
  FOR v_worker IN 
    SELECT id, full_name
    FROM production_workers
    WHERE office_id = p_office_id AND is_active = true
  LOOP
    -- Check if profile is locked
    SELECT is_locked INTO v_profile_locked
    FROM production_worker_skill_profiles
    WHERE worker_id = v_worker.id;
    
    IF v_profile_locked = true THEN
      CONTINUE;
    END IF;
    
    -- Get current period stats (last 7 days)
    SELECT 
      COALESCE(SUM(o.boxes_completed), 0) AS total_boxes,
      COALESCE(SUM(o.defects_count), 0) AS total_defects,
      COALESCE(SUM(o.tubes_produced), 0) AS total_tubes,
      COALESCE(AVG(o.tube_fill_seconds), 0) AS avg_fill_seconds,
      COALESCE(AVG(o.sticker_apply_seconds), 0) AS avg_sticker_seconds,
      COUNT(DISTINCT DATE(b.work_date)) AS days_worked,
      COALESCE(SUM(a.hours_worked), 0) AS total_hours
    INTO v_stats
    FROM production_batch_outputs o
    JOIN production_batches b ON o.batch_id = b.id
    LEFT JOIN production_worker_attendance a 
      ON a.worker_id = v_worker.id AND a.work_date = DATE(b.work_date)
    WHERE o.worker_id = v_worker.id
      AND b.work_date >= p_for_date - interval '7 days'
      AND b.work_date <= p_for_date;
    
    -- Get previous period stats (8-14 days ago)
    SELECT 
      COALESCE(SUM(o.boxes_completed), 0) AS total_boxes,
      COALESCE(SUM(o.defects_count), 0) AS total_defects,
      COALESCE(SUM(o.tubes_produced), 0) AS total_tubes,
      COUNT(DISTINCT DATE(b.work_date)) AS days_worked,
      COALESCE(SUM(a.hours_worked), 0) AS total_hours
    INTO v_prev_stats
    FROM production_batch_outputs o
    JOIN production_batches b ON o.batch_id = b.id
    LEFT JOIN production_worker_attendance a 
      ON a.worker_id = v_worker.id AND a.work_date = DATE(b.work_date)
    WHERE o.worker_id = v_worker.id
      AND b.work_date >= p_for_date - interval '14 days'
      AND b.work_date < p_for_date - interval '7 days';
    
    -- Speed score
    IF v_stats.total_hours > 0 THEN
      v_speed_score := LEAST(100, GREATEST(0, 
        ((v_stats.total_boxes::numeric / v_stats.total_hours) / 10.0 * 100)::integer));
    ELSE
      v_speed_score := 0;
    END IF;
    
    -- Quality score
    IF v_stats.total_tubes > 0 THEN
      v_quality_score := LEAST(100, GREATEST(0,
        (100 - (v_stats.total_defects::numeric / v_stats.total_tubes * 1000))::integer));
    ELSE
      v_quality_score := 100;
    END IF;
    
    -- Reliability score
    v_reliability_score := LEAST(100, GREATEST(0, (v_stats.days_worked::numeric / 7 * 100)::integer));
    
    -- Overall score
    v_overall_score := ((v_speed_score * 0.4) + (v_quality_score * 0.4) + (v_reliability_score * 0.2))::integer;
    
    -- Speed trend
    IF v_stats.total_hours > 0 AND v_prev_stats.total_hours > 0 THEN
      v_speed_delta := ((v_stats.total_boxes::numeric / v_stats.total_hours) - 
                        (v_prev_stats.total_boxes::numeric / v_prev_stats.total_hours)) /
                       NULLIF(v_prev_stats.total_boxes::numeric / v_prev_stats.total_hours, 0) * 100;
      IF v_speed_delta > 10 THEN v_trend_speed := 'improving';
      ELSIF v_speed_delta < -10 THEN v_trend_speed := 'declining';
      ELSE v_trend_speed := 'stable'; END IF;
    ELSE
      v_trend_speed := 'stable';
    END IF;
    
    -- Quality trend
    IF v_stats.total_tubes > 0 AND v_prev_stats.total_tubes > 0 THEN
      v_quality_delta := ((v_prev_stats.total_defects::numeric / NULLIF(v_prev_stats.total_tubes, 0)) -
                          (v_stats.total_defects::numeric / NULLIF(v_stats.total_tubes, 0))) /
                         NULLIF(v_prev_stats.total_defects::numeric / NULLIF(v_prev_stats.total_tubes, 0), 0) * 100;
      IF v_quality_delta > 10 THEN v_trend_quality := 'improving';
      ELSIF v_quality_delta < -10 THEN v_trend_quality := 'declining';
      ELSE v_trend_quality := 'stable'; END IF;
    ELSE
      v_trend_quality := 'stable';
    END IF;
    
    -- Reliability trend
    IF v_prev_stats.days_worked > 0 THEN
      v_reliability_delta := ((v_stats.days_worked::numeric - v_prev_stats.days_worked::numeric) /
                              v_prev_stats.days_worked::numeric) * 100;
      IF v_reliability_delta > 10 THEN v_trend_reliability := 'improving';
      ELSIF v_reliability_delta < -10 THEN v_trend_reliability := 'declining';
      ELSE v_trend_reliability := 'stable'; END IF;
    ELSE
      v_trend_reliability := 'stable';
    END IF;
    
    -- Upsert skill profile
    INSERT INTO production_worker_skill_profiles (
      worker_id, office_id,
      avg_tube_fill_seconds, avg_sticker_apply_seconds,
      defect_rate_per_thousand, boxes_per_hour,
      speed_score, quality_score, reliability_score, overall_score,
      trend_speed, trend_quality, trend_reliability,
      rolling_7d_boxes, rolling_7d_defects, rolling_7d_hours,
      calculation_date_range_start, calculation_date_range_end,
      calculation_version
    )
    VALUES (
      v_worker.id, p_office_id,
      v_stats.avg_fill_seconds, v_stats.avg_sticker_seconds,
      CASE WHEN v_stats.total_tubes > 0 
           THEN (v_stats.total_defects::numeric / v_stats.total_tubes * 1000) ELSE 0 END,
      CASE WHEN v_stats.total_hours > 0 
           THEN (v_stats.total_boxes::numeric / v_stats.total_hours) ELSE 0 END,
      v_speed_score, v_quality_score, v_reliability_score, v_overall_score,
      v_trend_speed, v_trend_quality, v_trend_reliability,
      v_stats.total_boxes, v_stats.total_defects, v_stats.total_hours,
      p_for_date - interval '7 days', p_for_date, 1
    )
    ON CONFLICT (worker_id) DO UPDATE SET
      office_id = EXCLUDED.office_id,
      avg_tube_fill_seconds = EXCLUDED.avg_tube_fill_seconds,
      avg_sticker_apply_seconds = EXCLUDED.avg_sticker_apply_seconds,
      defect_rate_per_thousand = EXCLUDED.defect_rate_per_thousand,
      boxes_per_hour = EXCLUDED.boxes_per_hour,
      speed_score = EXCLUDED.speed_score,
      quality_score = EXCLUDED.quality_score,
      reliability_score = EXCLUDED.reliability_score,
      overall_score = EXCLUDED.overall_score,
      trend_speed = EXCLUDED.trend_speed,
      trend_quality = EXCLUDED.trend_quality,
      trend_reliability = EXCLUDED.trend_reliability,
      rolling_7d_boxes = EXCLUDED.rolling_7d_boxes,
      rolling_7d_defects = EXCLUDED.rolling_7d_defects,
      rolling_7d_hours = EXCLUDED.rolling_7d_hours,
      calculation_date_range_start = EXCLUDED.calculation_date_range_start,
      calculation_date_range_end = EXCLUDED.calculation_date_range_end,
      calculation_version = production_worker_skill_profiles.calculation_version + 1,
      updated_at = now()
    WHERE production_worker_skill_profiles.is_locked = false;
    
    -- Create daily snapshot
    INSERT INTO production_worker_performance_snapshots (
      worker_id, office_id, snapshot_date,
      speed_score, quality_score, reliability_score, overall_score,
      boxes_completed, defects_count, hours_worked
    )
    VALUES (
      v_worker.id, p_office_id, p_for_date,
      v_speed_score, v_quality_score, v_reliability_score, v_overall_score,
      v_stats.total_boxes, v_stats.total_defects, v_stats.total_hours
    )
    ON CONFLICT (worker_id, snapshot_date) DO UPDATE SET
      speed_score = EXCLUDED.speed_score,
      quality_score = EXCLUDED.quality_score,
      reliability_score = EXCLUDED.reliability_score,
      overall_score = EXCLUDED.overall_score,
      boxes_completed = EXCLUDED.boxes_completed,
      defects_count = EXCLUDED.defects_count,
      hours_worked = EXCLUDED.hours_worked,
      updated_at = now()
    WHERE production_worker_performance_snapshots.is_locked = false;
  END LOOP;
END;
$$;

-- ============================================
-- PART 7: Admin Unlock Function
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_unlock_profile(
  p_worker_id uuid,
  p_unlocked_by uuid,
  p_reason text DEFAULT 'Manual admin unlock'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_production_elevated_role(p_unlocked_by) THEN
    RAISE EXCEPTION 'Insufficient permissions to unlock profiles';
  END IF;
  
  UPDATE production_worker_skill_profiles
  SET is_locked = false,
      locked_at = NULL,
      locked_by = NULL,
      lock_reason = 'Unlocked: ' || p_reason || ' by user at ' || now()
  WHERE worker_id = p_worker_id;
  
  RETURN FOUND;
END;
$$;

-- ============================================
-- PART 8: Retry Failed Queue Items
-- ============================================

CREATE OR REPLACE FUNCTION public.retry_failed_recalc_items(p_max_retries integer DEFAULT 3)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retried integer;
BEGIN
  WITH to_retry AS (
    UPDATE production_recalc_queue
    SET status = 'pending',
        started_at = NULL,
        processed_at = NULL,
        duration_ms = NULL,
        error_message = NULL
    WHERE status = 'failed'
      AND retry_count < p_max_retries
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_retried FROM to_retry;
  
  RETURN v_retried;
END;
$$;

-- ============================================
-- PART 9: Queue Cleanup Function
-- ============================================

CREATE OR REPLACE FUNCTION public.cleanup_old_recalc_items(p_days_old integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  WITH deleted AS (
    DELETE FROM production_recalc_queue
    WHERE status = 'success'
      AND processed_at < now() - (p_days_old || ' days')::interval
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted FROM deleted;
  
  RETURN v_deleted;
END;
$$;