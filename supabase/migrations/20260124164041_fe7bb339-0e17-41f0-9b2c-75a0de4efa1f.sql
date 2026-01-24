-- ═══════════════════════════════════════════════════════════════════════════
-- EXECUTIVE POLICY LAYER (EPL) - Autonomous Optimization Under Human Policy
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Executive Policies - The corridors AI operates within
CREATE TABLE public.executive_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  -- Policy Identity
  policy_name TEXT NOT NULL,
  policy_scope TEXT NOT NULL CHECK (policy_scope IN ('outbound_sales', 'product_launch', 'vendor_recruitment', 'marketplace_growth', 'store_reactivation', 'partnerships')),
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  
  -- Actions Control
  allowed_actions TEXT[] NOT NULL DEFAULT '{}',
  forbidden_actions TEXT[] NOT NULL DEFAULT '{}',
  approval_required_for TEXT[] NOT NULL DEFAULT '{}',
  
  -- Risk & Compliance
  risk_classification TEXT NOT NULL DEFAULT 'medium' CHECK (risk_classification IN ('low', 'medium', 'high', 'critical')),
  jurisdiction_constraints JSONB DEFAULT '{}',
  brand_voice_constraints JSONB DEFAULT '{}',
  
  -- Rate Limiting
  max_contact_rate INTEGER DEFAULT 100, -- per hour
  max_contacts_per_day INTEGER DEFAULT 500,
  cooldown_rules JSONB DEFAULT '{"min_hours_between_contacts": 24, "max_attempts_per_contact": 3}',
  
  -- Escalation & Rollback
  escalation_conditions JSONB DEFAULT '{}',
  rollback_triggers JSONB DEFAULT '{}',
  auto_disable_on_violation BOOLEAN DEFAULT true,
  
  -- Signing Authority
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'active', 'suspended', 'revoked', 'expired')),
  created_by UUID REFERENCES auth.users(id),
  signed_by UUID REFERENCES auth.users(id),
  signed_at TIMESTAMPTZ,
  signature_hash TEXT, -- Cryptographic signature
  expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Policy Violation Log - Immutable audit of policy breaches
CREATE TABLE public.policy_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID REFERENCES public.executive_policies(id) ON DELETE SET NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.outbound_campaigns(id) ON DELETE SET NULL,
  
  violation_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'minor', 'major', 'critical')),
  description TEXT NOT NULL,
  
  -- Context
  context_snapshot JSONB DEFAULT '{}',
  affected_entity_type TEXT,
  affected_entity_id TEXT,
  
  -- Resolution
  containment_action TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  
  -- Immutability
  row_hash TEXT,
  prev_hash TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Campaign Runs - Execution instances of campaigns
CREATE TABLE public.campaign_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.outbound_campaigns(id) ON DELETE CASCADE NOT NULL,
  policy_id UUID REFERENCES public.executive_policies(id) ON DELETE SET NULL NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  -- Run Identity
  run_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'halted', 'rolled_back')),
  
  -- Timing
  scheduled_start TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  
  -- Metrics
  total_targets INTEGER DEFAULT 0,
  contacts_attempted INTEGER DEFAULT 0,
  contacts_reached INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  escalations INTEGER DEFAULT 0,
  opt_outs INTEGER DEFAULT 0,
  violations INTEGER DEFAULT 0,
  
  -- Decision Context
  decision_engine_version TEXT DEFAULT '1.0',
  initial_confidence NUMERIC(5,4),
  final_confidence NUMERIC(5,4),
  
  -- Rollback
  rollback_triggered BOOLEAN DEFAULT false,
  rollback_reason TEXT,
  rollback_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Campaign Decisions - AI decisions within a campaign run
CREATE TABLE public.campaign_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.campaign_runs(id) ON DELETE CASCADE NOT NULL,
  campaign_id UUID REFERENCES public.outbound_campaigns(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES public.executive_policies(id) ON DELETE SET NULL,
  
  -- Decision Details
  decision_type TEXT NOT NULL CHECK (decision_type IN ('lead_selection', 'script_selection', 'timing', 'escalation', 'pause', 'stop', 'rollback')),
  decision_reason TEXT NOT NULL,
  
  -- Inputs
  sentinel_status TEXT,
  drift_score NUMERIC(5,4),
  performance_metrics JSONB DEFAULT '{}',
  context_signals JSONB DEFAULT '{}',
  
  -- Outputs
  action_plan JSONB DEFAULT '{}',
  confidence_score NUMERIC(5,4) NOT NULL,
  risk_flags TEXT[] DEFAULT '{}',
  
  -- Approval Context
  requires_human_approval BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  
  -- Audit Chain
  row_hash TEXT,
  prev_hash TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Campaign Audit Frames - Immutable snapshots for forensic replay
CREATE TABLE public.campaign_audit_frames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.campaign_runs(id) ON DELETE CASCADE NOT NULL,
  
  -- Frame Identity
  frame_number INTEGER NOT NULL,
  frame_type TEXT NOT NULL CHECK (frame_type IN ('state_snapshot', 'decision_point', 'action_executed', 'violation_detected', 'human_intervention', 'system_event')),
  
  -- State Capture
  campaign_state JSONB NOT NULL,
  sentinel_state JSONB DEFAULT '{}',
  policy_state JSONB DEFAULT '{}',
  
  -- Decision Trace
  decision_id UUID REFERENCES public.campaign_decisions(id),
  confidence_at_frame NUMERIC(5,4),
  drift_at_frame NUMERIC(5,4),
  
  -- Immutability
  row_hash TEXT NOT NULL,
  prev_hash TEXT,
  is_immutable BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Executive Decision Engine State - Global AI operator state
CREATE TABLE public.executive_decision_engine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE UNIQUE,
  
  -- Engine Status
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'active', 'paused', 'halted', 'maintenance')),
  mode TEXT NOT NULL DEFAULT 'supervised' CHECK (mode IN ('supervised', 'semi_autonomous', 'autonomous')),
  
  -- Active Context
  active_policy_ids UUID[] DEFAULT '{}',
  active_campaign_ids UUID[] DEFAULT '{}',
  active_run_ids UUID[] DEFAULT '{}',
  
  -- Performance Metrics
  total_decisions_today INTEGER DEFAULT 0,
  successful_executions_today INTEGER DEFAULT 0,
  escalations_today INTEGER DEFAULT 0,
  violations_today INTEGER DEFAULT 0,
  
  -- Trust & Confidence
  current_trust_score NUMERIC(5,4) DEFAULT 0.5,
  confidence_floor NUMERIC(5,4) DEFAULT 0.7,
  drift_ceiling NUMERIC(5,4) DEFAULT 0.15,
  
  -- Human Override
  human_override_active BOOLEAN DEFAULT false,
  override_reason TEXT,
  override_by UUID REFERENCES auth.users(id),
  override_expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Policy Signing Ceremony Log - Cryptographic approval trail
CREATE TABLE public.policy_signing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID REFERENCES public.executive_policies(id) ON DELETE CASCADE NOT NULL,
  
  action TEXT NOT NULL CHECK (action IN ('created', 'submitted', 'approved', 'rejected', 'suspended', 'revoked', 'expired', 'renewed')),
  actor_user_id UUID REFERENCES auth.users(id) NOT NULL,
  
  -- Cryptographic Proof
  signature_payload JSONB NOT NULL,
  signature_hash TEXT NOT NULL,
  prev_signature_hash TEXT,
  
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.executive_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_audit_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executive_decision_engine ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_signing_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admin/Owner access
CREATE POLICY "Admins can manage executive policies" ON public.executive_policies
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view policy violations" ON public.policy_violations
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage campaign runs" ON public.campaign_runs
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view campaign decisions" ON public.campaign_decisions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view audit frames" ON public.campaign_audit_frames
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage decision engine" ON public.executive_decision_engine
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view signing log" ON public.policy_signing_log
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Trigger: Auto-update timestamps
CREATE TRIGGER update_executive_policies_updated_at
  BEFORE UPDATE ON public.executive_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaign_runs_updated_at
  BEFORE UPDATE ON public.campaign_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_executive_decision_engine_updated_at
  BEFORE UPDATE ON public.executive_decision_engine
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: Hash chain for audit frames (immutability)
CREATE OR REPLACE FUNCTION public.hash_campaign_audit_frame()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev_hash_val TEXT;
BEGIN
  -- Get previous hash in chain
  SELECT row_hash INTO prev_hash_val
  FROM public.campaign_audit_frames
  WHERE run_id = NEW.run_id
  ORDER BY frame_number DESC
  LIMIT 1;
  
  NEW.prev_hash := prev_hash_val;
  NEW.row_hash := encode(sha256((NEW.run_id::text || NEW.frame_number::text || NEW.frame_type || NEW.campaign_state::text || COALESCE(NEW.prev_hash, ''))::bytea), 'hex');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER hash_campaign_audit_frame_trigger
  BEFORE INSERT ON public.campaign_audit_frames
  FOR EACH ROW EXECUTE FUNCTION public.hash_campaign_audit_frame();

-- Trigger: Auto-disable policy on critical violation
CREATE OR REPLACE FUNCTION public.auto_disable_policy_on_violation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.severity = 'critical' THEN
    UPDATE public.executive_policies
    SET status = 'suspended', updated_at = now()
    WHERE id = NEW.policy_id
    AND auto_disable_on_violation = true;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_disable_policy_on_violation_trigger
  AFTER INSERT ON public.policy_violations
  FOR EACH ROW EXECUTE FUNCTION public.auto_disable_policy_on_violation();

-- Trigger: Auto-halt run on violation threshold
CREATE OR REPLACE FUNCTION public.auto_halt_run_on_violations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  violation_count INTEGER;
  run_record RECORD;
BEGIN
  -- Count violations for this run's campaign
  SELECT COUNT(*) INTO violation_count
  FROM public.policy_violations
  WHERE campaign_id = (SELECT campaign_id FROM public.campaign_runs WHERE id = NEW.run_id);
  
  -- Auto-halt if violations exceed threshold (3)
  IF violation_count >= 3 THEN
    UPDATE public.campaign_runs
    SET status = 'halted', 
        rollback_triggered = true,
        rollback_reason = 'Auto-halted: Violation threshold exceeded (' || violation_count || ' violations)',
        rollback_at = now(),
        updated_at = now()
    WHERE id = NEW.run_id AND status = 'running';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_halt_run_on_violations_trigger
  AFTER INSERT ON public.policy_violations
  FOR EACH ROW EXECUTE FUNCTION public.auto_halt_run_on_violations();

-- Index for performance
CREATE INDEX idx_executive_policies_business_status ON public.executive_policies(business_id, status);
CREATE INDEX idx_executive_policies_scope ON public.executive_policies(policy_scope);
CREATE INDEX idx_policy_violations_policy ON public.policy_violations(policy_id, severity);
CREATE INDEX idx_campaign_runs_campaign ON public.campaign_runs(campaign_id, status);
CREATE INDEX idx_campaign_decisions_run ON public.campaign_decisions(run_id, decision_type);
CREATE INDEX idx_campaign_audit_frames_run ON public.campaign_audit_frames(run_id, frame_number);
CREATE INDEX idx_policy_signing_log_policy ON public.policy_signing_log(policy_id, action);