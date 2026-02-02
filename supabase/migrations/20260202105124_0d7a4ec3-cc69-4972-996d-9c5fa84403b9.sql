-- Phase 9.1: AI Trust Hardening & Shadow Mode
-- Add confidence_score to ai_action_queue if not exists
ALTER TABLE ai_action_queue 
ADD COLUMN IF NOT EXISTS confidence_score numeric(5,2) DEFAULT NULL;

-- Create ai_drift_alerts table for persisted drift detection
CREATE TABLE IF NOT EXISTS ai_drift_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL CHECK (alert_type IN ('overconfident', 'underconfident', 'rejection_spike', 'acceptance_spike')),
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('warning', 'critical')),
  message text NOT NULL,
  confidence_at_alert numeric(5,2),
  human_rate_at_alert numeric(5,2),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE ai_drift_alerts ENABLE ROW LEVEL SECURITY;

-- RLS: Owner/Admin can read all drift alerts
CREATE POLICY "Admins can view drift alerts" ON ai_drift_alerts
  FOR SELECT USING (true);

-- RLS: Only authenticated users can acknowledge
CREATE POLICY "Authenticated users can acknowledge alerts" ON ai_drift_alerts
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_ai_drift_alerts_status ON ai_drift_alerts(status);
CREATE INDEX IF NOT EXISTS idx_ai_drift_alerts_created ON ai_drift_alerts(created_at DESC);

-- Create RPC function to enforce kill switch when creating AI actions
-- This is the single gate for AI action creation
CREATE OR REPLACE FUNCTION create_ai_action_with_kill_switch_check(
  p_action_type text,
  p_action_summary text,
  p_ai_recommendation text,
  p_reasoning jsonb DEFAULT '{}',
  p_risk_level text DEFAULT 'low',
  p_confidence_score numeric DEFAULT NULL,
  p_worker_id uuid DEFAULT NULL,
  p_task_id uuid DEFAULT NULL,
  p_sla_deadline timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action_id uuid;
  v_global_kill boolean;
  v_worker_kill boolean;
BEGIN
  -- Check global kill switch
  SELECT EXISTS (
    SELECT 1 FROM ai_kill_switch_state 
    WHERE is_active = true AND scope = 'global'
  ) INTO v_global_kill;
  
  IF v_global_kill THEN
    RAISE EXCEPTION 'KILL_SWITCH_ACTIVE: Global AI operations are paused';
  END IF;
  
  -- Check worker-level kill switch
  IF p_worker_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM ai_kill_switch_state 
      WHERE is_active = true AND scope = 'worker' AND target_worker_id = p_worker_id
    ) INTO v_worker_kill;
    
    IF v_worker_kill THEN
      RAISE EXCEPTION 'KILL_SWITCH_ACTIVE: Worker % is paused', p_worker_id;
    END IF;
  END IF;
  
  -- Create the action (recommendation only - no execution)
  INSERT INTO ai_action_queue (
    action_type,
    action_summary,
    ai_recommendation,
    reasoning,
    risk_level,
    confidence_score,
    worker_id,
    task_id,
    sla_deadline,
    status
  ) VALUES (
    p_action_type,
    p_action_summary,
    p_ai_recommendation,
    p_reasoning,
    p_risk_level,
    p_confidence_score,
    p_worker_id,
    p_task_id,
    p_sla_deadline,
    'pending'
  )
  RETURNING id INTO v_action_id;
  
  RETURN v_action_id;
END;
$$;

-- Create function to acknowledge drift alerts (requires human action)
CREATE OR REPLACE FUNCTION acknowledge_drift_alert(
  p_alert_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE ai_drift_alerts
  SET 
    status = 'acknowledged',
    acknowledged_at = now(),
    acknowledged_by = COALESCE(p_user_id, auth.uid())
  WHERE id = p_alert_id AND status = 'open';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alert not found or already acknowledged';
  END IF;
END;
$$;

-- Create function to calculate and persist drift alerts from real data
CREATE OR REPLACE FUNCTION calculate_and_persist_drift_alerts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg_confidence numeric;
  v_acceptance_rate numeric;
  v_rejection_rate numeric;
  v_total_decisions integer;
  v_alert_count integer := 0;
BEGIN
  -- Calculate metrics from real action queue data (last 7 days)
  SELECT 
    COALESCE(AVG(confidence_score), 0),
    COUNT(*) FILTER (WHERE human_decision = 'accepted')::numeric / NULLIF(COUNT(*) FILTER (WHERE human_decision IS NOT NULL), 0) * 100,
    COUNT(*) FILTER (WHERE human_decision = 'rejected')::numeric / NULLIF(COUNT(*) FILTER (WHERE human_decision IS NOT NULL), 0) * 100,
    COUNT(*) FILTER (WHERE human_decision IS NOT NULL)
  INTO v_avg_confidence, v_acceptance_rate, v_rejection_rate, v_total_decisions
  FROM ai_action_queue
  WHERE created_at >= now() - interval '7 days'
    AND confidence_score IS NOT NULL;
  
  -- Skip if no data
  IF v_total_decisions < 5 THEN
    RETURN 0;
  END IF;
  
  -- Detect overconfident: High confidence + high rejection
  IF v_avg_confidence > 85 AND v_rejection_rate > 30 THEN
    INSERT INTO ai_drift_alerts (alert_type, severity, message, confidence_at_alert, human_rate_at_alert)
    VALUES ('overconfident', 'critical', 
      'AI is overconfident: High confidence (' || round(v_avg_confidence, 1) || '%) but frequent human rejection (' || round(v_rejection_rate, 1) || '%)',
      v_avg_confidence, v_rejection_rate);
    v_alert_count := v_alert_count + 1;
  END IF;
  
  -- Detect underconfident: Low confidence + high acceptance
  IF v_avg_confidence < 60 AND v_acceptance_rate > 80 THEN
    INSERT INTO ai_drift_alerts (alert_type, severity, message, confidence_at_alert, human_rate_at_alert)
    VALUES ('underconfident', 'warning', 
      'AI may be underconfident: Low confidence (' || round(v_avg_confidence, 1) || '%) but high human acceptance (' || round(v_acceptance_rate, 1) || '%)',
      v_avg_confidence, v_acceptance_rate);
    v_alert_count := v_alert_count + 1;
  END IF;
  
  RETURN v_alert_count;
END;
$$;

-- Add structured feedback columns to ai_action_queue for hardened feedback requirements
ALTER TABLE ai_action_queue
ADD COLUMN IF NOT EXISTS modification_what_changed text,
ADD COLUMN IF NOT EXISTS modification_why_changed text;

-- Add trigger to prevent updates without proper feedback
CREATE OR REPLACE FUNCTION enforce_feedback_requirements()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only enforce on decision updates
  IF NEW.human_decision IS NOT NULL AND OLD.human_decision IS NULL THEN
    -- Reject requires feedback
    IF NEW.human_decision = 'rejected' THEN
      IF NEW.decision_notes IS NULL OR length(trim(NEW.decision_notes)) < 10 THEN
        RAISE EXCEPTION 'FEEDBACK_REQUIRED: Rejection requires minimum 10 characters explanation';
      END IF;
    END IF;
    
    -- Modify requires structured feedback
    IF NEW.human_decision = 'modified' THEN
      IF NEW.decision_notes IS NULL OR length(trim(NEW.decision_notes)) < 10 THEN
        RAISE EXCEPTION 'FEEDBACK_REQUIRED: Modification requires explanation of what and why changed';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_enforce_feedback ON ai_action_queue;
CREATE TRIGGER trg_enforce_feedback
  BEFORE UPDATE ON ai_action_queue
  FOR EACH ROW
  EXECUTE FUNCTION enforce_feedback_requirements();

-- Create view for real confidence drift data
CREATE OR REPLACE VIEW v_confidence_drift_metrics AS
SELECT 
  date_trunc('day', created_at)::date as date,
  COALESCE(AVG(confidence_score), 0) as avg_confidence,
  COUNT(*) FILTER (WHERE human_decision = 'accepted')::numeric / NULLIF(COUNT(*) FILTER (WHERE human_decision IS NOT NULL), 0) * 100 as acceptance_rate,
  COUNT(*) FILTER (WHERE human_decision = 'rejected')::numeric / NULLIF(COUNT(*) FILTER (WHERE human_decision IS NOT NULL), 0) * 100 as rejection_rate,
  COUNT(*) FILTER (WHERE human_decision IS NOT NULL) as total_decisions
FROM ai_action_queue
WHERE created_at >= now() - interval '30 days'
GROUP BY date_trunc('day', created_at)::date
ORDER BY date DESC;