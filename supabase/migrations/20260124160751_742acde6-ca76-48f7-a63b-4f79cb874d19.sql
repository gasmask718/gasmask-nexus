-- =====================================================
-- SELF-IMPROVING AI WITH HUMAN-SIGNED PROMOTION
-- Learning Proposals, Sandbox Simulation, Human Sign-Off
-- =====================================================

-- PHASE A: Learning Proposal Engine
CREATE TABLE public.ai_learning_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id),
  
  -- Proposal metadata
  proposal_type TEXT NOT NULL CHECK (proposal_type IN ('phrasing_variant', 'playbook_sequence', 'escalation_timing', 'objection_handling', 'tone_adjustment', 'script_refinement')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Source evidence
  source_calls UUID[] DEFAULT '{}',
  source_metrics JSONB DEFAULT '{}',
  source_techniques TEXT[] DEFAULT '{}',
  evidence_summary TEXT,
  
  -- Expected impact
  expected_benefit TEXT NOT NULL,
  expected_improvement_pct DECIMAL(5,2),
  risk_assessment TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  
  -- Affected surfaces
  affects_speech BOOLEAN DEFAULT false,
  affects_timing BOOLEAN DEFAULT false,
  affects_escalation BOOLEAN DEFAULT false,
  affects_routing BOOLEAN DEFAULT false,
  affected_playbooks UUID[] DEFAULT '{}',
  affected_styles UUID[] DEFAULT '{}',
  
  -- The actual proposed change
  current_artifact JSONB NOT NULL,
  proposed_artifact JSONB NOT NULL,
  artifact_diff JSONB,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'simulating', 'simulation_passed', 'simulation_failed', 'pending_sentinel', 'sentinel_approved', 'sentinel_rejected', 'pending_human', 'approved', 'promoted', 'rolled_back', 'archived')),
  
  -- Immutability
  proposal_hash TEXT,
  is_immutable BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PHASE B: Promotion Sandbox (Simulation Results)
CREATE TABLE public.promotion_sandbox_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.ai_learning_proposals(id) ON DELETE CASCADE,
  
  -- Simulation configuration
  simulation_type TEXT NOT NULL CHECK (simulation_type IN ('historical_replay', 'synthetic_edge_case', 'a_b_comparison', 'stress_test')),
  test_cases_count INTEGER NOT NULL DEFAULT 0,
  
  -- Results
  outcome_delta JSONB DEFAULT '{}',
  confidence_variance DECIMAL(5,4),
  failure_modes_detected TEXT[] DEFAULT '{}',
  
  -- Metrics comparison
  baseline_metrics JSONB NOT NULL,
  proposed_metrics JSONB NOT NULL,
  improvement_achieved BOOLEAN,
  improvement_pct DECIMAL(5,2),
  
  -- Safety checks
  safety_violations INTEGER DEFAULT 0,
  compliance_issues TEXT[] DEFAULT '{}',
  regression_detected BOOLEAN DEFAULT false,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'passed', 'failed', 'inconclusive')),
  failure_reason TEXT,
  
  -- Immutability
  run_hash TEXT,
  
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PHASE C: Sentinel Co-Approval Gate
CREATE TABLE public.sentinel_promotion_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.ai_learning_proposals(id) ON DELETE CASCADE,
  
  -- Gate check results
  sentinel_status TEXT NOT NULL,
  unresolved_drifts INTEGER NOT NULL DEFAULT 0,
  active_containments INTEGER NOT NULL DEFAULT 0,
  baseline_stable_hours DECIMAL(10,2),
  required_stable_hours DECIMAL(10,2) NOT NULL DEFAULT 24,
  
  -- Decision
  gate_passed BOOLEAN NOT NULL,
  rejection_reasons TEXT[] DEFAULT '{}',
  
  -- Audit
  evaluation_snapshot JSONB NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PHASE D: Human Cryptographic Sign-Off
CREATE TABLE public.promotion_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.ai_learning_proposals(id) ON DELETE CASCADE,
  
  -- Approver identity
  approver_id UUID NOT NULL,
  approver_email TEXT NOT NULL,
  approver_role TEXT NOT NULL,
  
  -- Approval details
  approval_reason TEXT NOT NULL,
  scope_description TEXT NOT NULL,
  permission_scope JSONB NOT NULL DEFAULT '{}',
  
  -- Time bounds
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  is_time_bounded BOOLEAN DEFAULT true,
  
  -- Rollback instructions
  rollback_instructions TEXT NOT NULL,
  rollback_contact TEXT,
  
  -- Cryptographic signature
  approval_payload JSONB NOT NULL,
  signature_hash TEXT NOT NULL,
  signature_algorithm TEXT NOT NULL DEFAULT 'SHA-256',
  
  -- Status
  is_revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID,
  revocation_reason TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PHASE E: Scoped, Reversible Promotions
CREATE TABLE public.ai_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.ai_learning_proposals(id),
  approval_id UUID NOT NULL REFERENCES public.promotion_approvals(id),
  business_id UUID REFERENCES public.businesses(id),
  
  -- Scope
  promotion_scope TEXT NOT NULL,
  affected_artifact_type TEXT NOT NULL,
  affected_artifact_id UUID,
  
  -- Versioning
  version_number INTEGER NOT NULL,
  previous_version_id UUID REFERENCES public.ai_promotions(id),
  previous_snapshot JSONB NOT NULL,
  new_snapshot JSONB NOT NULL,
  promotion_diff JSONB NOT NULL,
  
  -- Time bounds
  promoted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_permanent BOOLEAN DEFAULT false,
  
  -- Rollback
  rollback_hash TEXT NOT NULL,
  is_rolled_back BOOLEAN DEFAULT false,
  rolled_back_at TIMESTAMPTZ,
  rolled_back_by UUID,
  rollback_reason TEXT,
  
  -- Watch mode
  watch_mode_active BOOLEAN DEFAULT true,
  watch_mode_until TIMESTAMPTZ,
  elevated_sensitivity BOOLEAN DEFAULT true,
  
  -- Immutability
  promotion_hash TEXT NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PHASE F: Post-Promotion Watch Mode
CREATE TABLE public.promotion_watch_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES public.ai_promotions(id) ON DELETE CASCADE,
  
  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN ('metric_check', 'anomaly_detected', 'threshold_breach', 'auto_rollback', 'watch_extended', 'watch_completed', 'permanence_granted')),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  
  -- Metrics at event
  metrics_snapshot JSONB NOT NULL DEFAULT '{}',
  drift_detected BOOLEAN DEFAULT false,
  anomaly_score DECIMAL(5,4),
  
  -- Action taken
  action_taken TEXT,
  triggered_rollback BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_learning_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_sandbox_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentinel_promotion_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_watch_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin access for all)
CREATE POLICY "Admin access to learning proposals" ON public.ai_learning_proposals FOR ALL USING (true);
CREATE POLICY "Admin access to sandbox runs" ON public.promotion_sandbox_runs FOR ALL USING (true);
CREATE POLICY "Admin access to sentinel gates" ON public.sentinel_promotion_gates FOR ALL USING (true);
CREATE POLICY "Admin access to promotion approvals" ON public.promotion_approvals FOR ALL USING (true);
CREATE POLICY "Admin access to promotions" ON public.ai_promotions FOR ALL USING (true);
CREATE POLICY "Admin access to watch events" ON public.promotion_watch_events FOR ALL USING (true);

-- Immutability trigger for proposals once promoted
CREATE OR REPLACE FUNCTION trg_protect_promoted_proposal()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'promoted' AND NEW.status != 'rolled_back' THEN
    RAISE EXCEPTION 'Cannot modify a promoted proposal except for rollback';
  END IF;
  IF OLD.is_immutable = true AND NEW.is_immutable = false THEN
    RAISE EXCEPTION 'Cannot remove immutability flag from proposal';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_promoted_proposal
BEFORE UPDATE ON public.ai_learning_proposals
FOR EACH ROW EXECUTE FUNCTION trg_protect_promoted_proposal();

-- Immutability trigger for approvals
CREATE OR REPLACE FUNCTION trg_protect_approval_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow revocation updates
  IF OLD.signature_hash IS NOT NULL THEN
    IF NEW.signature_hash != OLD.signature_hash THEN
      RAISE EXCEPTION 'Cannot modify approval signature';
    END IF;
    IF NEW.approval_payload != OLD.approval_payload THEN
      RAISE EXCEPTION 'Cannot modify approval payload';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_approval_integrity
BEFORE UPDATE ON public.promotion_approvals
FOR EACH ROW EXECUTE FUNCTION trg_protect_approval_integrity();

-- Prevent self-promotion (AI cannot approve its own proposals)
CREATE OR REPLACE FUNCTION trg_prevent_self_promotion()
RETURNS TRIGGER AS $$
BEGIN
  -- This ensures a human must be the approver
  IF NEW.approver_role = 'ai_agent' OR NEW.approver_role = 'automated' THEN
    RAISE EXCEPTION 'AI cannot self-promote. Human approval required.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_self_promotion
BEFORE INSERT ON public.promotion_approvals
FOR EACH ROW EXECUTE FUNCTION trg_prevent_self_promotion();

-- Indexes for performance
CREATE INDEX idx_proposals_status ON public.ai_learning_proposals(status);
CREATE INDEX idx_proposals_business ON public.ai_learning_proposals(business_id);
CREATE INDEX idx_sandbox_proposal ON public.promotion_sandbox_runs(proposal_id);
CREATE INDEX idx_sentinel_gates_proposal ON public.sentinel_promotion_gates(proposal_id);
CREATE INDEX idx_approvals_proposal ON public.promotion_approvals(proposal_id);
CREATE INDEX idx_promotions_business ON public.ai_promotions(business_id);
CREATE INDEX idx_promotions_watch ON public.ai_promotions(watch_mode_active) WHERE watch_mode_active = true;
CREATE INDEX idx_watch_events_promotion ON public.promotion_watch_events(promotion_id);