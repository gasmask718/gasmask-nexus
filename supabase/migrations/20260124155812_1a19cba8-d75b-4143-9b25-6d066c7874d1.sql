-- ============================================
-- COMPLIANCE SENTINEL: CONTINUOUS ASSURANCE LAYER
-- ============================================

-- Compliance Baselines: Certified reference points for drift detection
CREATE TABLE public.compliance_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id),
  baseline_name text NOT NULL,
  baseline_version text NOT NULL DEFAULT '1.0.0',
  is_active boolean DEFAULT false,
  is_regulator_grade boolean DEFAULT false,
  supersedes_baseline_id uuid REFERENCES public.compliance_baselines(id),
  
  -- Certified thresholds
  min_permission_rate numeric DEFAULT 99.0,
  max_kill_switch_latency_ms integer DEFAULT 100,
  max_confidence_breach_rate numeric DEFAULT 1.0,
  max_human_takeover_latency_ms integer DEFAULT 5000,
  max_unapproved_technique_count integer DEFAULT 0,
  min_audit_completeness_rate numeric DEFAULT 99.0,
  
  -- Source evidence
  source_evidence_pack_ids uuid[] DEFAULT '{}',
  source_simulation_ids uuid[] DEFAULT '{}',
  
  -- Certification
  certified_at timestamptz,
  certified_by text,
  certification_hash text,
  certification_notes text,
  
  -- Metadata
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Sentinel Evaluations: Proof of continuous monitoring
CREATE TABLE public.sentinel_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id),
  baseline_id uuid REFERENCES public.compliance_baselines(id),
  
  -- Evaluation details
  evaluation_type text NOT NULL, -- 'scheduled', 'event_triggered', 'manual'
  trigger_event text, -- what caused the evaluation
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  
  -- Results
  status text DEFAULT 'running', -- 'running', 'passed', 'warning', 'critical', 'failed'
  metrics_evaluated jsonb DEFAULT '{}',
  thresholds_checked jsonb DEFAULT '{}',
  drift_detected boolean DEFAULT false,
  drift_count integer DEFAULT 0,
  
  -- Integrity
  evaluation_hash text,
  prev_evaluation_id uuid REFERENCES public.sentinel_evaluations(id),
  prev_evaluation_hash text,
  
  -- Metadata
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Compliance Drift Events: Detected deviations from baseline
CREATE TABLE public.compliance_drift_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id),
  baseline_id uuid REFERENCES public.compliance_baselines(id),
  evaluation_id uuid REFERENCES public.sentinel_evaluations(id),
  
  -- Drift classification
  severity text NOT NULL, -- 'info', 'warning', 'critical'
  drift_type text NOT NULL, -- 'permission_rate', 'kill_switch_latency', 'confidence_breach', etc.
  metric_name text NOT NULL,
  
  -- Deviation details
  baseline_value numeric,
  current_value numeric,
  deviation_magnitude numeric,
  deviation_percentage numeric,
  drift_direction text, -- 'above_threshold', 'below_threshold'
  
  -- Duration tracking
  first_detected_at timestamptz DEFAULT now(),
  last_detected_at timestamptz DEFAULT now(),
  duration_seconds integer DEFAULT 0,
  occurrence_count integer DEFAULT 1,
  
  -- Resolution
  is_resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by text,
  resolution_notes text,
  
  -- Containment
  triggered_containment boolean DEFAULT false,
  containment_action_id uuid,
  
  -- Integrity
  event_hash text,
  
  -- Metadata
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Sentinel Containment Actions: Auto-actions taken to prevent violations
CREATE TABLE public.sentinel_containment_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id),
  drift_event_id uuid REFERENCES public.compliance_drift_events(id),
  evaluation_id uuid REFERENCES public.sentinel_evaluations(id),
  
  -- Action details
  action_type text NOT NULL, -- 'downgrade_to_canary', 'downgrade_to_assisted', 'lock_ai_speech', 'full_halt'
  action_reason text NOT NULL,
  severity_at_action text NOT NULL,
  
  -- State changes
  previous_mode text,
  new_mode text,
  affected_agents uuid[] DEFAULT '{}',
  affected_routes text[] DEFAULT '{}',
  
  -- Execution
  executed_at timestamptz DEFAULT now(),
  execution_success boolean DEFAULT true,
  execution_error text,
  
  -- Recovery
  requires_human_approval_to_restore boolean DEFAULT true,
  restored_at timestamptz,
  restored_by text,
  restore_approved_by text,
  restore_notes text,
  
  -- Audit
  action_hash text,
  is_immutable boolean DEFAULT true,
  
  -- Metadata
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Sentinel Status: Current system-wide sentinel state
CREATE TABLE public.sentinel_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) UNIQUE,
  
  -- Current state
  compliance_state text DEFAULT 'unknown', -- 'compliant', 'degraded', 'halted', 'unknown'
  active_baseline_id uuid REFERENCES public.compliance_baselines(id),
  
  -- Sentinel health
  sentinel_enabled boolean DEFAULT true,
  last_evaluation_at timestamptz,
  last_evaluation_id uuid REFERENCES public.sentinel_evaluations(id),
  last_evaluation_status text,
  evaluation_interval_seconds integer DEFAULT 300, -- 5 minutes default
  
  -- Drift summary
  active_drift_count integer DEFAULT 0,
  active_critical_count integer DEFAULT 0,
  active_warning_count integer DEFAULT 0,
  
  -- Containment state
  is_contained boolean DEFAULT false,
  containment_level text, -- 'canary', 'assisted', 'halted'
  containment_reason text,
  containment_started_at timestamptz,
  
  -- Time tracking
  time_since_last_clean_ms bigint DEFAULT 0,
  last_clean_evaluation_at timestamptz,
  
  -- Metadata
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_compliance_baselines_active ON public.compliance_baselines(is_active) WHERE is_active = true;
CREATE INDEX idx_sentinel_evaluations_status ON public.sentinel_evaluations(status, created_at DESC);
CREATE INDEX idx_drift_events_unresolved ON public.compliance_drift_events(is_resolved, severity) WHERE is_resolved = false;
CREATE INDEX idx_containment_actions_pending ON public.sentinel_containment_actions(restored_at) WHERE restored_at IS NULL;
CREATE INDEX idx_sentinel_status_state ON public.sentinel_status(compliance_state);

-- RLS Policies
ALTER TABLE public.compliance_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentinel_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_drift_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentinel_containment_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentinel_status ENABLE ROW LEVEL SECURITY;

-- Service role policies (edge functions use service role)
CREATE POLICY "Service role full access to compliance_baselines" ON public.compliance_baselines FOR ALL USING (true);
CREATE POLICY "Service role full access to sentinel_evaluations" ON public.sentinel_evaluations FOR ALL USING (true);
CREATE POLICY "Service role full access to compliance_drift_events" ON public.compliance_drift_events FOR ALL USING (true);
CREATE POLICY "Service role full access to sentinel_containment_actions" ON public.sentinel_containment_actions FOR ALL USING (true);
CREATE POLICY "Service role full access to sentinel_status" ON public.sentinel_status FOR ALL USING (true);

-- Trigger to prevent disabling sentinel without audit
CREATE OR REPLACE FUNCTION audit_sentinel_disable()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.sentinel_enabled = true AND NEW.sentinel_enabled = false THEN
    -- Log this as a critical audit event
    INSERT INTO public.compliance_drift_events (
      business_id, 
      severity, 
      drift_type, 
      metric_name,
      baseline_value,
      current_value,
      metadata
    ) VALUES (
      NEW.business_id,
      'critical',
      'sentinel_disabled',
      'sentinel_enabled',
      1,
      0,
      jsonb_build_object(
        'action', 'sentinel_disabled',
        'timestamp', now(),
        'requires_immediate_review', true
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_sentinel_disable
  BEFORE UPDATE ON public.sentinel_status
  FOR EACH ROW
  EXECUTE FUNCTION audit_sentinel_disable();

-- Trigger to make containment actions immutable
CREATE OR REPLACE FUNCTION prevent_containment_action_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_immutable = true THEN
    -- Only allow updating restoration fields
    IF (
      OLD.action_type != NEW.action_type OR
      OLD.action_reason != NEW.action_reason OR
      OLD.previous_mode != NEW.previous_mode OR
      OLD.new_mode != NEW.new_mode OR
      OLD.executed_at != NEW.executed_at
    ) THEN
      RAISE EXCEPTION 'Cannot modify immutable containment action core fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_containment_modification
  BEFORE UPDATE ON public.sentinel_containment_actions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_containment_action_modification();