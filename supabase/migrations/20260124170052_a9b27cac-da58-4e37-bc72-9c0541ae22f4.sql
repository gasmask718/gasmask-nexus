-- =====================================================
-- EXECUTIVE DIRECTIVES & POWERS SYSTEM
-- Authority, Delegation & Guarded Execution
-- =====================================================

-- =====================================================
-- 1. EXECUTIVE DIRECTIVES (First-class strategic objects)
-- AI executes directives, it does not decide strategy
-- =====================================================
CREATE TABLE IF NOT EXISTS public.executive_directives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id),
  
  -- Core directive definition
  directive_name TEXT NOT NULL,
  directive_type TEXT NOT NULL CHECK (directive_type IN (
    'growth', 'recovery', 'test', 'hold', 'launch', 'acquisition', 'optimization'
  )),
  scope TEXT NOT NULL CHECK (scope IN ('brand', 'business', 'campaign', 'global')),
  
  -- Human authority
  issued_by UUID REFERENCES auth.users(id),
  issued_at TIMESTAMPTZ DEFAULT now(),
  
  -- Intent and constraints
  strategic_intent TEXT NOT NULL,
  target_metrics JSONB DEFAULT '{}',
  constraints JSONB DEFAULT '{}',
  success_criteria JSONB DEFAULT '{}',
  
  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'active', 'paused', 'completed', 'expired', 'revoked'
  )),
  effective_from TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revocation_allowed BOOLEAN DEFAULT true,
  
  -- Links to policies
  required_policy_ids UUID[] DEFAULT '{}',
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.executive_directives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage directives for their business"
  ON public.executive_directives
  FOR ALL
  USING (public.can_access_brand_by_user(auth.uid(), business_id));

-- =====================================================
-- 2. EXECUTIVE POWERS MATRIX
-- Defines what AI CAN and CANNOT do - enforced in code
-- =====================================================
CREATE TABLE IF NOT EXISTS public.executive_powers_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id),
  
  -- Power definitions
  power_category TEXT NOT NULL CHECK (power_category IN (
    'campaign_management', 'resource_allocation', 'playbook_selection',
    'escalation', 'containment', 'reporting', 'learning'
  )),
  
  -- Explicit capability mapping
  allowed_powers TEXT[] DEFAULT '{}',
  forbidden_powers TEXT[] DEFAULT '{}',
  requires_approval_powers TEXT[] DEFAULT '{}',
  
  -- Override rules
  human_override_bypasses_all BOOLEAN DEFAULT false,
  sentinel_can_restrict BOOLEAN DEFAULT true,
  
  -- Activation
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.executive_powers_matrix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage powers for their business"
  ON public.executive_powers_matrix
  FOR ALL
  USING (public.can_access_brand_by_user(auth.uid(), business_id));

-- =====================================================
-- 3. EXECUTIVE MEMORY ARTIFACTS
-- AI learns from history but cannot rewrite it
-- =====================================================
CREATE TABLE IF NOT EXISTS public.executive_memory_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id),
  
  -- Memory classification
  memory_type TEXT NOT NULL CHECK (memory_type IN (
    'directive_outcome', 'campaign_result', 'decision_quality',
    'policy_effectiveness', 'escalation_pattern', 'failure_mode'
  )),
  
  -- References
  directive_id UUID REFERENCES public.executive_directives(id),
  campaign_id UUID,
  policy_id UUID REFERENCES public.executive_policies(id),
  
  -- Memory content (IMMUTABLE after creation)
  artifact_title TEXT NOT NULL,
  artifact_summary TEXT,
  outcome_data JSONB DEFAULT '{}',
  lessons_learned TEXT[],
  what_worked TEXT[],
  what_failed TEXT[],
  
  -- Metrics at time of event
  success_score DECIMAL(5,4),
  confidence_at_time DECIMAL(5,4),
  
  -- Immutability
  is_immutable BOOLEAN DEFAULT true,
  row_hash TEXT,
  prev_hash TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.executive_memory_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read memory for their business"
  ON public.executive_memory_artifacts
  FOR SELECT
  USING (public.can_access_brand_by_user(auth.uid(), business_id));

-- AI cannot rewrite history - insert only for non-owners
CREATE POLICY "Memory artifacts are insert-only"
  ON public.executive_memory_artifacts
  FOR INSERT
  WITH CHECK (public.can_access_brand_by_user(auth.uid(), business_id));

-- =====================================================
-- 4. EXECUTIVE SIMULATION RUNS
-- No simulation = no execution
-- =====================================================
CREATE TABLE IF NOT EXISTS public.executive_simulation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id),
  directive_id UUID REFERENCES public.executive_directives(id),
  
  -- Simulation config
  simulation_name TEXT NOT NULL,
  simulation_type TEXT NOT NULL CHECK (simulation_type IN (
    'what_if', 'stress_test', 'risk_assessment', 'compliance_check', 'rollback_dry_run'
  )),
  
  -- Input parameters
  input_parameters JSONB DEFAULT '{}',
  
  -- Projections
  projected_outcomes JSONB DEFAULT '{}',
  expected_call_volume INTEGER,
  risk_exposure_score DECIMAL(5,4),
  compliance_load_score DECIMAL(5,4),
  sentinel_stress_projection DECIMAL(5,4),
  
  -- Results
  simulation_passed BOOLEAN,
  failure_reasons TEXT[],
  recommendations TEXT[],
  
  -- Lifecycle
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'completed', 'failed', 'approved', 'rejected'
  )),
  run_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.executive_simulation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage simulations for their business"
  ON public.executive_simulation_runs
  FOR ALL
  USING (public.can_access_brand_by_user(auth.uid(), business_id));

-- =====================================================
-- 5. ADD directive_id TO OUTBOUND CAMPAIGNS
-- Every campaign must reference a directive
-- =====================================================
ALTER TABLE public.outbound_campaigns 
ADD COLUMN IF NOT EXISTS directive_id UUID REFERENCES public.executive_directives(id);

-- =====================================================
-- 6. ADVISORY-ONLY MODE TRACKING
-- When safety conditions fail, AI speaks but cannot act
-- =====================================================
ALTER TABLE public.executive_decision_engine 
ADD COLUMN IF NOT EXISTS advisory_only_mode BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS advisory_reason TEXT,
ADD COLUMN IF NOT EXISTS advisory_triggered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS safety_conditions JSONB DEFAULT '{
  "sentinel_status": "compliant",
  "containment_active": false,
  "regulatory_drill_passed": true,
  "audit_completeness_threshold": 0.95
}';

-- =====================================================
-- 7. HASH CHAIN TRIGGER FOR MEMORY ARTIFACTS
-- =====================================================
CREATE OR REPLACE FUNCTION public.hash_memory_artifact()
RETURNS TRIGGER AS $$
DECLARE
  prev_row public.executive_memory_artifacts%ROWTYPE;
BEGIN
  SELECT * INTO prev_row FROM public.executive_memory_artifacts 
  WHERE business_id = NEW.business_id 
  ORDER BY created_at DESC LIMIT 1;
  
  NEW.prev_hash := COALESCE(prev_row.row_hash, 'genesis');
  NEW.row_hash := encode(sha256((
    NEW.id::text || 
    NEW.business_id::text || 
    NEW.memory_type || 
    COALESCE(NEW.artifact_title, '') ||
    NEW.prev_hash
  )::bytea), 'hex');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS hash_memory_artifact_trigger ON public.executive_memory_artifacts;
CREATE TRIGGER hash_memory_artifact_trigger
  BEFORE INSERT ON public.executive_memory_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION public.hash_memory_artifact();

-- =====================================================
-- 8. AUTO-EXPIRE DIRECTIVES FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.expire_old_directives()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if directive has expired
  IF NEW.expires_at IS NOT NULL AND NEW.expires_at < NOW() AND NEW.status = 'active' THEN
    NEW.status := 'expired';
    
    -- Pause any campaigns linked to this directive
    UPDATE public.outbound_campaigns 
    SET status = 'paused'
    WHERE directive_id = NEW.id AND status IN ('active', 'approved');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_expire_directives ON public.executive_directives;
CREATE TRIGGER auto_expire_directives
  BEFORE UPDATE ON public.executive_directives
  FOR EACH ROW
  EXECUTE FUNCTION public.expire_old_directives();

-- =====================================================
-- 9. ADVISORY MODE AUTO-TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION public.check_advisory_mode()
RETURNS TRIGGER AS $$
DECLARE
  safety_check JSONB;
  should_be_advisory BOOLEAN := false;
  advisory_reasons TEXT[] := '{}';
BEGIN
  safety_check := NEW.safety_conditions;
  
  -- Check all safety conditions
  IF (safety_check->>'sentinel_status') NOT IN ('compliant', 'warning') THEN
    should_be_advisory := true;
    advisory_reasons := array_append(advisory_reasons, 'Sentinel status degraded or halted');
  END IF;
  
  IF (safety_check->>'containment_active')::boolean = true THEN
    should_be_advisory := true;
    advisory_reasons := array_append(advisory_reasons, 'Active containment in progress');
  END IF;
  
  IF (safety_check->>'regulatory_drill_passed')::boolean = false THEN
    should_be_advisory := true;
    advisory_reasons := array_append(advisory_reasons, 'Regulatory drill failed');
  END IF;
  
  IF (safety_check->>'audit_completeness_threshold')::decimal < 0.90 THEN
    should_be_advisory := true;
    advisory_reasons := array_append(advisory_reasons, 'Audit completeness below threshold');
  END IF;
  
  -- Apply advisory mode if needed
  IF should_be_advisory AND NOT NEW.advisory_only_mode THEN
    NEW.advisory_only_mode := true;
    NEW.advisory_reason := array_to_string(advisory_reasons, '; ');
    NEW.advisory_triggered_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_advisory_mode ON public.executive_decision_engine;
CREATE TRIGGER auto_advisory_mode
  BEFORE UPDATE ON public.executive_decision_engine
  FOR EACH ROW
  EXECUTE FUNCTION public.check_advisory_mode();

-- =====================================================
-- 10. UPDATED_AT TRIGGERS
-- =====================================================
DROP TRIGGER IF EXISTS update_executive_directives_updated_at ON public.executive_directives;
CREATE TRIGGER update_executive_directives_updated_at
  BEFORE UPDATE ON public.executive_directives
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_executive_powers_matrix_updated_at ON public.executive_powers_matrix;
CREATE TRIGGER update_executive_powers_matrix_updated_at
  BEFORE UPDATE ON public.executive_powers_matrix
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 11. INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_directives_business_status ON public.executive_directives(business_id, status);
CREATE INDEX IF NOT EXISTS idx_directives_expires_at ON public.executive_directives(expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_memory_business_type ON public.executive_memory_artifacts(business_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_simulations_directive ON public.executive_simulation_runs(directive_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_directive ON public.outbound_campaigns(directive_id);