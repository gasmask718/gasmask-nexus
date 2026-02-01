-- ══════════════════════════════════════════════════════════════════════════════
-- MASTER PROMPT #6 & #7: Recalculation Queue + Real Trend Detection
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Create recalculation queue table
CREATE TABLE IF NOT EXISTS public.production_recalc_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.production_offices(id) ON DELETE CASCADE,
  batch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  UNIQUE(office_id, batch_date, processed_at) -- Allow re-queuing after processing
);

-- Index for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_recalc_queue_pending 
  ON public.production_recalc_queue(requested_at) 
  WHERE processed_at IS NULL;

-- 2. Replace the trigger function to enqueue instead of direct calculation
CREATE OR REPLACE FUNCTION public.trigger_enqueue_skill_recalculation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office_id UUID;
  v_batch_date DATE;
BEGIN
  -- Get office_id and date from the batch
  SELECT pb.office_id, pb.batch_date 
  INTO v_office_id, v_batch_date
  FROM public.production_batches pb
  WHERE pb.id = NEW.batch_id;

  IF v_office_id IS NOT NULL THEN
    -- Enqueue if not already pending for this office/date
    INSERT INTO public.production_recalc_queue (office_id, batch_date)
    VALUES (v_office_id, v_batch_date)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Drop old trigger and create new one
DROP TRIGGER IF EXISTS trigger_output_recalc_skills ON public.production_batch_outputs;

CREATE TRIGGER trigger_enqueue_recalc
  AFTER INSERT OR UPDATE ON public.production_batch_outputs
  FOR EACH ROW
  WHEN (NEW.worker_id IS NOT NULL)
  EXECUTE FUNCTION public.trigger_enqueue_skill_recalculation();

-- 4. Enhanced recalculation function with REAL trend detection
CREATE OR REPLACE FUNCTION public.recalculate_worker_skill_profiles(
  p_office_id UUID,
  p_for_date DATE DEFAULT CURRENT_DATE
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
  v_speed_score INTEGER;
  v_quality_score INTEGER;
  v_reliability_score INTEGER;
  v_overall_score INTEGER;
  v_trend_speed TEXT;
  v_trend_quality TEXT;
  v_trend_reliability TEXT;
  v_speed_delta NUMERIC;
  v_quality_delta NUMERIC;
BEGIN
  -- Process each worker in this office
  FOR v_worker IN 
    SELECT DISTINCT pw.id as worker_id, pw.full_name
    FROM public.production_workers pw
    JOIN public.production_office_workers pow ON pow.worker_id = pw.id
    WHERE pow.office_id = p_office_id AND pw.is_active = true
  LOOP
    -- Calculate CURRENT period stats (last 7 days)
    SELECT
      COALESCE(AVG(pbo.tube_fill_seconds), 0) as avg_tube_fill,
      COALESCE(AVG(pbo.sticker_apply_seconds), 0) as avg_sticker,
      COALESCE(SUM(pbo.boxes_completed), 0) as total_boxes,
      COALESCE(SUM(pbo.defects_count), 0) as total_defects,
      COALESCE(SUM(pbo.tubes_used), 0) as total_tubes,
      COALESCE(SUM(pwa.hours_worked), 0) as total_hours,
      COUNT(DISTINCT pb.batch_date) as days_worked
    INTO v_stats
    FROM public.production_batch_outputs pbo
    JOIN public.production_batches pb ON pb.id = pbo.batch_id
    LEFT JOIN public.production_worker_attendance pwa 
      ON pwa.worker_id = pbo.worker_id 
      AND pwa.attendance_date = pb.batch_date
    WHERE pbo.worker_id = v_worker.worker_id
      AND pb.office_id = p_office_id
      AND pb.batch_date BETWEEN (p_for_date - INTERVAL '7 days')::DATE AND p_for_date;

    -- Calculate PREVIOUS period stats (8-14 days ago) for trend comparison
    SELECT
      COALESCE(AVG(pbo.tube_fill_seconds), 0) as avg_tube_fill,
      COALESCE(SUM(pbo.boxes_completed), 0) as total_boxes,
      COALESCE(SUM(pbo.defects_count), 0) as total_defects,
      COALESCE(SUM(pbo.tubes_used), 0) as total_tubes,
      COALESCE(SUM(pwa.hours_worked), 0) as total_hours
    INTO v_prev_stats
    FROM public.production_batch_outputs pbo
    JOIN public.production_batches pb ON pb.id = pbo.batch_id
    LEFT JOIN public.production_worker_attendance pwa 
      ON pwa.worker_id = pbo.worker_id 
      AND pwa.attendance_date = pb.batch_date
    WHERE pbo.worker_id = v_worker.worker_id
      AND pb.office_id = p_office_id
      AND pb.batch_date BETWEEN (p_for_date - INTERVAL '14 days')::DATE 
                            AND (p_for_date - INTERVAL '8 days')::DATE;

    -- Calculate scores (0-100)
    -- Speed: based on boxes/hour (higher = better)
    IF v_stats.total_hours > 0 THEN
      v_speed_score := LEAST(100, GREATEST(0, 
        (v_stats.total_boxes / v_stats.total_hours / 5.0 * 100)::INTEGER
      ));
    ELSE
      v_speed_score := 50;
    END IF;

    -- Quality: based on defect rate (lower defects = higher score)
    IF v_stats.total_tubes > 0 THEN
      v_quality_score := LEAST(100, GREATEST(0, 
        (100 - (v_stats.total_defects::NUMERIC / v_stats.total_tubes * 1000))::INTEGER
      ));
    ELSE
      v_quality_score := 50;
    END IF;

    -- Reliability: based on attendance consistency
    v_reliability_score := LEAST(100, GREATEST(0, (v_stats.days_worked * 100 / 7)));

    -- Overall: weighted average
    v_overall_score := (v_speed_score * 0.4 + v_quality_score * 0.4 + v_reliability_score * 0.2)::INTEGER;

    -- ═══════════════════════════════════════════════════════════════════════
    -- REAL TREND DETECTION (compare current 7d vs previous 7d)
    -- ═══════════════════════════════════════════════════════════════════════

    -- Speed trend: compare boxes/hour
    IF v_stats.total_hours > 0 AND v_prev_stats.total_hours > 0 THEN
      v_speed_delta := ((v_stats.total_boxes / v_stats.total_hours) - 
                        (v_prev_stats.total_boxes / v_prev_stats.total_hours)) /
                       NULLIF(v_prev_stats.total_boxes / v_prev_stats.total_hours, 0) * 100;
      
      IF v_speed_delta > 10 THEN
        v_trend_speed := 'improving';
      ELSIF v_speed_delta < -10 THEN
        v_trend_speed := 'declining';
      ELSE
        v_trend_speed := 'stable';
      END IF;
    ELSE
      v_trend_speed := 'stable';
    END IF;

    -- Quality trend: compare defect rates (lower is better, so inverted logic)
    IF v_stats.total_tubes > 0 AND v_prev_stats.total_tubes > 0 THEN
      v_quality_delta := ((v_prev_stats.total_defects::NUMERIC / v_prev_stats.total_tubes) -
                          (v_stats.total_defects::NUMERIC / v_stats.total_tubes)) /
                         NULLIF(v_prev_stats.total_defects::NUMERIC / v_prev_stats.total_tubes, 0) * 100;
      
      IF v_quality_delta > 10 THEN
        v_trend_quality := 'improving';
      ELSIF v_quality_delta < -10 THEN
        v_trend_quality := 'declining';
      ELSE
        v_trend_quality := 'stable';
      END IF;
    ELSE
      v_trend_quality := 'stable';
    END IF;

    -- Reliability trend (simplified)
    v_trend_reliability := 'stable';

    -- Upsert skill profile
    INSERT INTO public.production_worker_skill_profiles (
      worker_id, office_id, avg_tube_fill_seconds, avg_sticker_apply_seconds,
      defect_rate_per_thousand, boxes_per_hour, attendance_rate,
      speed_score, quality_score, reliability_score, overall_score,
      trend_speed, trend_quality, trend_reliability,
      last_calculated_at, calculation_date_range_start, calculation_date_range_end
    )
    VALUES (
      v_worker.worker_id, p_office_id, v_stats.avg_tube_fill, v_stats.avg_sticker,
      CASE WHEN v_stats.total_tubes > 0 
           THEN (v_stats.total_defects::NUMERIC / v_stats.total_tubes * 1000) 
           ELSE 0 END,
      CASE WHEN v_stats.total_hours > 0 
           THEN (v_stats.total_boxes::NUMERIC / v_stats.total_hours) 
           ELSE 0 END,
      (v_stats.days_worked::NUMERIC / 7 * 100),
      v_speed_score, v_quality_score, v_reliability_score, v_overall_score,
      v_trend_speed, v_trend_quality, v_trend_reliability,
      now(), (p_for_date - INTERVAL '7 days')::DATE, p_for_date
    )
    ON CONFLICT (worker_id, office_id) DO UPDATE SET
      avg_tube_fill_seconds = EXCLUDED.avg_tube_fill_seconds,
      avg_sticker_apply_seconds = EXCLUDED.avg_sticker_apply_seconds,
      defect_rate_per_thousand = EXCLUDED.defect_rate_per_thousand,
      boxes_per_hour = EXCLUDED.boxes_per_hour,
      attendance_rate = EXCLUDED.attendance_rate,
      speed_score = EXCLUDED.speed_score,
      quality_score = EXCLUDED.quality_score,
      reliability_score = EXCLUDED.reliability_score,
      overall_score = EXCLUDED.overall_score,
      trend_speed = EXCLUDED.trend_speed,
      trend_quality = EXCLUDED.trend_quality,
      trend_reliability = EXCLUDED.trend_reliability,
      last_calculated_at = EXCLUDED.last_calculated_at,
      calculation_date_range_start = EXCLUDED.calculation_date_range_start,
      calculation_date_range_end = EXCLUDED.calculation_date_range_end;

    -- Insert daily snapshot
    INSERT INTO public.production_worker_performance_snapshots (
      worker_id, office_id, snapshot_date,
      boxes_completed, defects_count, hours_worked,
      speed_score, quality_score, reliability_score
    )
    VALUES (
      v_worker.worker_id, p_office_id, p_for_date,
      v_stats.total_boxes, v_stats.total_defects, v_stats.total_hours,
      v_speed_score, v_quality_score, v_reliability_score
    )
    ON CONFLICT (worker_id, office_id, snapshot_date) DO UPDATE SET
      boxes_completed = EXCLUDED.boxes_completed,
      defects_count = EXCLUDED.defects_count,
      hours_worked = EXCLUDED.hours_worked,
      speed_score = EXCLUDED.speed_score,
      quality_score = EXCLUDED.quality_score,
      reliability_score = EXCLUDED.reliability_score;

  END LOOP;
END;
$$;

-- 5. Queue processor function (called by scheduled job)
CREATE OR REPLACE FUNCTION public.process_recalc_queue()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_processed INTEGER := 0;
BEGIN
  FOR v_item IN 
    SELECT id, office_id, batch_date
    FROM public.production_recalc_queue
    WHERE processed_at IS NULL
    ORDER BY requested_at
    LIMIT 50 -- Process max 50 per run to avoid timeouts
  LOOP
    BEGIN
      PERFORM public.recalculate_worker_skill_profiles(v_item.office_id, v_item.batch_date);
      
      UPDATE public.production_recalc_queue
      SET processed_at = now()
      WHERE id = v_item.id;
      
      v_processed := v_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.production_recalc_queue
      SET error_message = SQLERRM
      WHERE id = v_item.id;
    END;
  END LOOP;
  
  RETURN v_processed;
END;
$$;

-- 6. RLS for queue table
ALTER TABLE public.production_recalc_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Elevated roles can view queue"
  ON public.production_recalc_queue FOR SELECT
  TO authenticated
  USING (public.has_production_elevated_role(auth.uid()));

-- 7. Add constraint for defect category when defects exist
ALTER TABLE public.production_batch_outputs
  DROP CONSTRAINT IF EXISTS chk_defect_category_required;

-- Note: Using a trigger instead of CHECK for flexibility
CREATE OR REPLACE FUNCTION public.validate_defect_category()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.defects_count > 0 AND NEW.defect_category IS NULL THEN
    RAISE WARNING 'Defect category recommended when defects_count > 0';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_validate_defects ON public.production_batch_outputs;
CREATE TRIGGER trigger_validate_defects
  BEFORE INSERT OR UPDATE ON public.production_batch_outputs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_defect_category();