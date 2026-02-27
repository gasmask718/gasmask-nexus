
-- Phase 1: Add forecast columns to dialer_intelligence_runs
ALTER TABLE dialer_intelligence_runs
  ADD COLUMN IF NOT EXISTS forecast_window_days int DEFAULT 7,
  ADD COLUMN IF NOT EXISTS projected_attempts numeric,
  ADD COLUMN IF NOT EXISTS projected_connects numeric,
  ADD COLUMN IF NOT EXISTS projected_revenue numeric,
  ADD COLUMN IF NOT EXISTS projected_cost numeric,
  ADD COLUMN IF NOT EXISTS projected_profit numeric,
  ADD COLUMN IF NOT EXISTS forecast_confidence numeric,
  ADD COLUMN IF NOT EXISTS forecast_inputs jsonb;

-- Phase 2: Create forecast_revenue_trajectory RPC
CREATE OR REPLACE FUNCTION public.forecast_revenue_trajectory(
  p_business_id uuid,
  p_window_days int DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_connect_rate numeric;
  v_avg_revenue_per_connect numeric;
  v_avg_cost_per_attempt numeric;
  v_queue_depth bigint;
  v_attempt_capacity_per_day numeric;
  v_attempts_30d bigint;
  v_revenue_stddev numeric;
  v_profit_throttled boolean;
  v_adaptive_locked boolean;
  v_projected_attempts numeric;
  v_projected_connects numeric;
  v_projected_revenue numeric;
  v_projected_cost numeric;
  v_projected_profit numeric;
  v_confidence numeric;
BEGIN
  -- Connect rate: rolling from last 100 attempts
  SELECT COALESCE(
    (SELECT COUNT(*) FILTER (WHERE status = 'answered' OR status = 'bridged')::numeric
     / NULLIF(COUNT(*)::numeric, 0)
     FROM outbound_call_queue
     WHERE business_id = p_business_id
       AND status IN ('answered', 'bridged', 'no_answer', 'voicemail', 'failed', 'completed')
     ORDER BY updated_at DESC
     LIMIT 500),
    0.15
  ) INTO v_connect_rate;

  -- Clamp connect rate
  IF v_connect_rate < 0.01 THEN v_connect_rate := 0.15; END IF;
  IF v_connect_rate > 0.95 THEN v_connect_rate := 0.95; END IF;

  -- Avg revenue per connect (last 30 days)
  SELECT COALESCE(
    AVG(re.amount), 0
  ) INTO v_avg_revenue_per_connect
  FROM call_revenue_events re
  WHERE re.business_id = p_business_id
    AND re.created_at >= NOW() - INTERVAL '30 days';

  -- Avg cost per attempt (last 30 days)
  SELECT COALESCE(
    AVG(ce.estimated_cost), 0
  ) INTO v_avg_cost_per_attempt
  FROM call_cost_events ce
  WHERE ce.business_id = p_business_id
    AND ce.created_at >= NOW() - INTERVAL '30 days';

  -- Queue depth
  SELECT COUNT(*) INTO v_queue_depth
  FROM outbound_call_queue
  WHERE business_id = p_business_id
    AND status IN ('queued', 'retry');

  -- Attempt capacity per day (avg from last 7 days of cycle logs)
  SELECT COALESCE(
    AVG(daily_attempts), 50
  ) INTO v_attempt_capacity_per_day
  FROM (
    SELECT DATE(started_at) AS d, SUM(claimed_count) AS daily_attempts
    FROM dialer_engine_cycle_logs
    WHERE business_id = p_business_id
      AND started_at >= NOW() - INTERVAL '7 days'
    GROUP BY DATE(started_at)
  ) sub;

  -- Total attempts last 30d (for confidence)
  SELECT COUNT(*) INTO v_attempts_30d
  FROM call_cost_events
  WHERE business_id = p_business_id
    AND created_at >= NOW() - INTERVAL '30 days';

  -- Revenue stddev (for confidence)
  SELECT COALESCE(STDDEV(amount), 0) INTO v_revenue_stddev
  FROM call_revenue_events
  WHERE business_id = p_business_id
    AND created_at >= NOW() - INTERVAL '30 days';

  -- Check throttle/lock state from latest run
  SELECT
    COALESCE(dir.stability_notes ILIKE '%profit_throttle%', false),
    COALESCE(dir.adaptive_locked, false)
  INTO v_profit_throttled, v_adaptive_locked
  FROM dialer_intelligence_runs dir
  WHERE dir.business_id = p_business_id
  ORDER BY dir.started_at DESC
  LIMIT 1;

  -- Projection math (deterministic v1)
  v_projected_attempts := LEAST(v_queue_depth, v_attempt_capacity_per_day * p_window_days);
  v_projected_connects := v_projected_attempts * v_connect_rate;
  v_projected_revenue := v_projected_connects * v_avg_revenue_per_connect;
  v_projected_cost := v_projected_attempts * v_avg_cost_per_attempt;
  v_projected_profit := v_projected_revenue - v_projected_cost;

  -- Confidence score (bounded 0.2–0.95)
  v_confidence := 0.85;
  IF v_attempts_30d < 200 THEN v_confidence := v_confidence - 0.15; END IF;
  IF v_revenue_stddev > v_avg_revenue_per_connect * 0.5 THEN v_confidence := v_confidence - 0.10; END IF;
  IF v_profit_throttled THEN v_confidence := v_confidence - 0.10; END IF;
  IF v_adaptive_locked THEN v_confidence := v_confidence - 0.10; END IF;
  v_confidence := GREATEST(0.2, LEAST(0.95, v_confidence));

  RETURN jsonb_build_object(
    'window_days', p_window_days,
    'projected_attempts', ROUND(v_projected_attempts, 2),
    'projected_connects', ROUND(v_projected_connects, 2),
    'projected_revenue', ROUND(v_projected_revenue, 2),
    'projected_cost', ROUND(v_projected_cost, 2),
    'projected_profit', ROUND(v_projected_profit, 2),
    'confidence', ROUND(v_confidence, 3),
    'inputs', jsonb_build_object(
      'connect_rate', ROUND(v_connect_rate, 4),
      'avg_revenue_per_connect', ROUND(v_avg_revenue_per_connect, 2),
      'avg_cost_per_attempt', ROUND(v_avg_cost_per_attempt, 4),
      'queue_depth', v_queue_depth,
      'attempt_capacity_per_day', ROUND(v_attempt_capacity_per_day, 1),
      'attempts_30d', v_attempts_30d,
      'revenue_stddev', ROUND(v_revenue_stddev, 2),
      'profit_throttled', v_profit_throttled,
      'adaptive_locked', v_adaptive_locked
    )
  );
END;
$$;
