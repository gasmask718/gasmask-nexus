-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 3.5: OPERATIONAL ACTIVATION — Database Functions & Triggers
-- Automatic analytics computation, playbook rules, and autonomy guardrails
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Create playbook_actions table for CTA tracking
CREATE TABLE IF NOT EXISTS public.playbook_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  alert_id UUID REFERENCES public.delivery_alerts(id) ON DELETE SET NULL,
  playbook_rule TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_label TEXT NOT NULL,
  priority INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'dismissed')),
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dismissed_reason TEXT
);

-- Enable RLS
ALTER TABLE public.playbook_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for playbook_actions
CREATE POLICY "Staff can view playbook actions"
  ON public.playbook_actions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can manage playbook actions"
  ON public.playbook_actions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. Create analytics_computation_log for tracking automatic computations
CREATE TABLE IF NOT EXISTS public.analytics_computation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE NOT NULL,
  worker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  computation_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  error_message TEXT,
  computed_at TIMESTAMPTZ DEFAULT now(),
  duration_ms INTEGER
);

-- Enable RLS
ALTER TABLE public.analytics_computation_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Staff can view computation logs"
  ON public.analytics_computation_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert computation logs"
  ON public.analytics_computation_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3. Create autonomy_blocks table for tracking blocked autonomy
CREATE TABLE IF NOT EXISTS public.autonomy_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  block_reason TEXT NOT NULL,
  block_type TEXT NOT NULL CHECK (block_type IN ('declining_trend', 'critical_exception', 'sla_breach', 'low_reliability', 'insufficient_routes', 'requires_training')),
  is_active BOOLEAN DEFAULT true,
  blocked_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  cleared_at TIMESTAMPTZ,
  cleared_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  context JSONB
);

-- Enable RLS
ALTER TABLE public.autonomy_blocks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Staff can view autonomy blocks"
  ON public.autonomy_blocks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can manage autonomy blocks"
  ON public.autonomy_blocks FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_playbook_actions_worker ON public.playbook_actions(worker_id);
CREATE INDEX IF NOT EXISTS idx_playbook_actions_status ON public.playbook_actions(status);
CREATE INDEX IF NOT EXISTS idx_autonomy_blocks_worker_active ON public.autonomy_blocks(worker_id, is_active);
CREATE INDEX IF NOT EXISTS idx_analytics_log_route ON public.analytics_computation_log(route_id);

-- 5. Function to queue analytics computation (called by trigger)
CREATE OR REPLACE FUNCTION public.queue_route_analytics_computation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger when route becomes completed
  IF NEW.route_state = 'completed' AND (OLD.route_state IS NULL OR OLD.route_state != 'completed') THEN
    -- Insert computation request into log
    INSERT INTO public.analytics_computation_log (route_id, worker_id, computation_type, status)
    VALUES (NEW.id, NEW.assigned_to, 'route_completion', 'pending');
    
    -- Also create an alert if computation is needed
    INSERT INTO public.delivery_alerts (
      route_id,
      alert_type,
      severity,
      title,
      description,
      status
    ) VALUES (
      NEW.id,
      'stalled_route',
      'low',
      'Route analytics pending',
      'Route completed - analytics computation queued',
      'resolved'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 6. Create trigger for automatic analytics queueing
DROP TRIGGER IF EXISTS trigger_queue_route_analytics ON public.routes;
CREATE TRIGGER trigger_queue_route_analytics
  AFTER UPDATE OF route_state ON public.routes
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_route_analytics_computation();

-- 7. Function to check and enforce autonomy guardrails
CREATE OR REPLACE FUNCTION public.check_autonomy_eligibility(p_worker_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_performance RECORD;
  v_blocks JSONB := '[]'::JSONB;
  v_eligible BOOLEAN := true;
  v_recent_critical INTEGER;
BEGIN
  -- Get worker performance
  SELECT * INTO v_performance
  FROM public.worker_performance
  WHERE worker_id = p_worker_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'No performance data');
  END IF;
  
  -- Check declining trend
  IF v_performance.trend_direction = 'declining' THEN
    v_eligible := false;
    v_blocks := v_blocks || jsonb_build_object('type', 'declining_trend', 'message', 'Performance trend is declining');
  END IF;
  
  -- Check reliability score
  IF v_performance.reliability_score < 60 THEN
    v_eligible := false;
    v_blocks := v_blocks || jsonb_build_object('type', 'low_reliability', 'message', 'Reliability score below threshold');
  END IF;
  
  -- Check minimum routes
  IF v_performance.routes_completed_30d < 10 THEN
    v_eligible := false;
    v_blocks := v_blocks || jsonb_build_object('type', 'insufficient_routes', 'message', 'Not enough routes completed');
  END IF;
  
  -- Check training flag
  IF v_performance.requires_training THEN
    v_eligible := false;
    v_blocks := v_blocks || jsonb_build_object('type', 'requires_training', 'message', 'Training required');
  END IF;
  
  -- Check recent critical exceptions (last 7 days)
  SELECT COUNT(*) INTO v_recent_critical
  FROM public.delivery_exceptions de
  JOIN public.deliveries d ON de.delivery_id = d.id
  JOIN public.routes r ON d.route_id = r.id
  WHERE r.assigned_to = p_worker_id
    AND de.severity = 'critical'
    AND de.created_at > now() - INTERVAL '7 days';
  
  IF v_recent_critical > 0 THEN
    v_eligible := false;
    v_blocks := v_blocks || jsonb_build_object('type', 'critical_exception', 'message', 'Recent critical exceptions');
  END IF;
  
  -- Check SLA breaches (last 7 days)
  IF EXISTS (
    SELECT 1 FROM public.delivery_alerts
    WHERE escalated_to IS NOT NULL
      AND sla_breached = true
      AND created_at > now() - INTERVAL '7 days'
      AND route_id IN (SELECT id FROM public.routes WHERE assigned_to = p_worker_id)
  ) THEN
    v_eligible := false;
    v_blocks := v_blocks || jsonb_build_object('type', 'sla_breach', 'message', 'Recent SLA breaches');
  END IF;
  
  RETURN jsonb_build_object(
    'eligible', v_eligible,
    'current_level', v_performance.autonomy_level,
    'trust_score', v_performance.trust_score,
    'reliability_score', v_performance.reliability_score,
    'blocks', v_blocks
  );
END;
$$;

-- 8. Function to generate playbook actions based on worker performance
CREATE OR REPLACE FUNCTION public.evaluate_playbook_rules(p_worker_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_performance RECORD;
BEGIN
  SELECT * INTO v_performance
  FROM public.worker_performance
  WHERE worker_id = p_worker_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Rule: Declining Performance
  IF v_performance.trend_direction = 'declining' OR v_performance.reliability_score < 60 THEN
    -- Check if action already exists
    IF NOT EXISTS (
      SELECT 1 FROM public.playbook_actions
      WHERE worker_id = p_worker_id
        AND playbook_rule = 'declining_performance'
        AND status = 'pending'
        AND created_at > now() - INTERVAL '7 days'
    ) THEN
      INSERT INTO public.playbook_actions (worker_id, playbook_rule, action_type, action_label, priority, context)
      VALUES (
        p_worker_id,
        'declining_performance',
        'coaching',
        'Schedule Coaching Session',
        1,
        jsonb_build_object(
          'reliability_score', v_performance.reliability_score,
          'trend', v_performance.trend_direction
        )
      );
      
      INSERT INTO public.playbook_actions (worker_id, playbook_rule, action_type, action_label, priority, context)
      VALUES (
        p_worker_id,
        'declining_performance',
        'reduce_load',
        'Reduce Route Load',
        2,
        jsonb_build_object('current_avg_routes', v_performance.routes_completed_7d)
      );
    END IF;
  END IF;
  
  -- Rule: High Performer - Eligible for Promotion
  IF v_performance.trust_score >= 85 
     AND v_performance.trend_direction = 'improving' 
     AND v_performance.routes_completed_30d >= 15
     AND v_performance.autonomy_level != 'auto_eligible' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.playbook_actions
      WHERE worker_id = p_worker_id
        AND playbook_rule = 'high_performer'
        AND status = 'pending'
        AND created_at > now() - INTERVAL '30 days'
    ) THEN
      INSERT INTO public.playbook_actions (worker_id, playbook_rule, action_type, action_label, priority, context)
      VALUES (
        p_worker_id,
        'high_performer',
        'promote_autonomy',
        'Enable Assisted Routing',
        1,
        jsonb_build_object(
          'trust_score', v_performance.trust_score,
          'routes_30d', v_performance.routes_completed_30d
        )
      );
      
      INSERT INTO public.playbook_actions (worker_id, playbook_rule, action_type, action_label, priority, context)
      VALUES (
        p_worker_id,
        'high_performer',
        'increase_capacity',
        'Increase Route Capacity',
        2,
        jsonb_build_object('current_level', v_performance.autonomy_level)
      );
    END IF;
  END IF;
  
END;
$$;