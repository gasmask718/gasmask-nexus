-- =====================================================
-- OUTBOUND CALL EXECUTION BINDING SYSTEM
-- Ensures NO CALL without: campaign, disclosure, audit
-- =====================================================

-- ===========================================
-- PART 1: EXECUTION BINDING TABLES
-- ===========================================

-- Campaign Run tracking (each time a campaign executes)
CREATE TABLE IF NOT EXISTS public.campaign_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.outbound_campaigns(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'completed', 'halted', 'cancelled')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_targets INTEGER DEFAULT 0,
  calls_attempted INTEGER DEFAULT 0,
  calls_completed INTEGER DEFAULT 0,
  calls_failed INTEGER DEFAULT 0,
  disclosure_violations INTEGER DEFAULT 0,
  opt_outs INTEGER DEFAULT 0,
  escalations INTEGER DEFAULT 0,
  execution_mode TEXT NOT NULL DEFAULT 'test' CHECK (execution_mode IN ('test', 'canary', 'assisted', 'live')),
  started_by UUID REFERENCES auth.users(id),
  halted_by UUID REFERENCES auth.users(id),
  halt_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Test call whitelist (only these numbers can receive test calls)
CREATE TABLE IF NOT EXISTS public.test_call_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  label TEXT,
  is_internal BOOLEAN DEFAULT false,
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(business_id, phone_number)
);

-- AI Disclosure tracking per call
CREATE TABLE IF NOT EXISTS public.call_disclosure_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.ai_call_sessions(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.outbound_campaigns(id),
  campaign_run_id UUID REFERENCES public.campaign_runs(id),
  disclosure_spoken BOOLEAN NOT NULL DEFAULT false,
  disclosure_text_used TEXT,
  disclosure_timestamp_ms INTEGER,
  disclosure_acknowledged BOOLEAN DEFAULT false,
  disclosure_failed BOOLEAN DEFAULT false,
  failure_reason TEXT,
  call_terminated_for_violation BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Execution gate validation log
CREATE TABLE IF NOT EXISTS public.execution_gate_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.ai_call_sessions(id),
  campaign_id UUID REFERENCES public.outbound_campaigns(id),
  campaign_run_id UUID REFERENCES public.campaign_runs(id),
  business_id UUID REFERENCES public.businesses(id),
  gate_check_passed BOOLEAN NOT NULL,
  checks_performed JSONB NOT NULL DEFAULT '[]',
  failed_checks TEXT[],
  call_blocked BOOLEAN DEFAULT false,
  block_reason TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- PART 2: EXTEND AI_CALL_SESSIONS
-- ===========================================

-- Add campaign binding columns to ai_call_sessions
ALTER TABLE public.ai_call_sessions 
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.outbound_campaigns(id),
ADD COLUMN IF NOT EXISTS campaign_run_id UUID REFERENCES public.campaign_runs(id),
ADD COLUMN IF NOT EXISTS execution_mode TEXT DEFAULT 'manual' CHECK (execution_mode IN ('manual', 'test', 'canary', 'assisted', 'live')),
ADD COLUMN IF NOT EXISTS is_test_call BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS disclosure_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS kill_switch_terminated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS frame_written BOOLEAN DEFAULT false;

-- ===========================================
-- PART 3: CALL FRAME GUARANTEES
-- ===========================================

-- Ensure campaign_call_frames has required fields
ALTER TABLE public.campaign_call_frames
ADD COLUMN IF NOT EXISTS disclosure_spoken BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS objections JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS opt_out_requested BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS escalation_triggered BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS frame_valid BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS validation_errors TEXT[];

-- ===========================================
-- PART 4: KILL SWITCH ENHANCEMENTS
-- ===========================================

-- Real-time kill switch state for instant checking
CREATE TABLE IF NOT EXISTS public.kill_switch_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('global', 'business', 'campaign')),
  business_id UUID REFERENCES public.businesses(id),
  campaign_id UUID REFERENCES public.outbound_campaigns(id),
  is_active BOOLEAN NOT NULL DEFAULT false,
  triggered_at TIMESTAMPTZ,
  triggered_by UUID REFERENCES auth.users(id),
  trigger_reason TEXT,
  requires_manual_reset BOOLEAN DEFAULT true,
  reset_at TIMESTAMPTZ,
  reset_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(scope, business_id, campaign_id)
);

-- Initialize global kill switch state
INSERT INTO public.kill_switch_state (scope, is_active)
VALUES ('global', false)
ON CONFLICT DO NOTHING;

-- ===========================================
-- PART 5: TEST CALL RATE LIMITING
-- ===========================================

CREATE TABLE IF NOT EXISTS public.test_call_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  calls_made INTEGER DEFAULT 0,
  max_calls_per_day INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(business_id, date)
);

-- ===========================================
-- PART 6: PLAYBOOK BINDING REQUIREMENTS
-- ===========================================

-- Ensure outbound_campaigns require playbook binding
ALTER TABLE public.outbound_campaigns
ADD COLUMN IF NOT EXISTS requires_product_playbook BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_vendor_playbook BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS playbook_validated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS playbook_validation_error TEXT;

-- ===========================================
-- PART 7: AUDIT ASSERTIONS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.execution_audit_assertions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assertion_name TEXT NOT NULL,
  assertion_query TEXT NOT NULL,
  expected_result BOOLEAN NOT NULL DEFAULT true,
  last_check_result BOOLEAN,
  last_check_at TIMESTAMPTZ,
  violation_count INTEGER DEFAULT 0,
  is_critical BOOLEAN DEFAULT false,
  auto_halt_on_violation BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert core assertions
INSERT INTO public.execution_audit_assertions (assertion_name, assertion_query, is_critical, auto_halt_on_violation) VALUES
('no_session_without_campaign', 'SELECT NOT EXISTS (SELECT 1 FROM ai_call_sessions WHERE campaign_id IS NULL AND execution_mode != ''manual'' AND is_test_call = false)', true, true),
('no_frame_without_disclosure', 'SELECT NOT EXISTS (SELECT 1 FROM campaign_call_frames ccf JOIN ai_call_sessions acs ON ccf.call_session_id = acs.id WHERE ccf.disclosure_spoken = false AND acs.execution_mode = ''live'')', true, true),
('no_active_with_containment', 'SELECT NOT EXISTS (SELECT 1 FROM outbound_campaigns WHERE status = ''active'' AND containment_active = true)', true, true),
('no_live_without_approval', 'SELECT NOT EXISTS (SELECT 1 FROM outbound_campaigns WHERE status = ''active'' AND approved_at IS NULL)', true, true)
ON CONFLICT DO NOTHING;

-- ===========================================
-- PART 8: ENABLE RLS
-- ===========================================

ALTER TABLE public.campaign_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_call_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_disclosure_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_gate_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kill_switch_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_call_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_audit_assertions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view campaign runs" ON public.campaign_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view test whitelist" ON public.test_call_whitelist FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view disclosure logs" ON public.call_disclosure_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view gate logs" ON public.execution_gate_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view kill switch state" ON public.kill_switch_state FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view rate limits" ON public.test_call_rate_limits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view assertions" ON public.execution_audit_assertions FOR SELECT TO authenticated USING (true);

-- ===========================================
-- PART 9: AUTO-CONTAINMENT TRIGGERS
-- ===========================================

-- Trigger to auto-halt campaign on disclosure violation spike
CREATE OR REPLACE FUNCTION public.check_disclosure_violations()
RETURNS TRIGGER AS $$
DECLARE
  violation_count INTEGER;
  campaign_row RECORD;
BEGIN
  -- Only check if this is a violation
  IF NEW.disclosure_failed = true THEN
    -- Count recent violations for this campaign
    SELECT COUNT(*) INTO violation_count
    FROM public.call_disclosure_log
    WHERE campaign_id = NEW.campaign_id
    AND disclosure_failed = true
    AND created_at > NOW() - INTERVAL '1 hour';
    
    -- If more than 3 violations in an hour, trigger containment
    IF violation_count >= 3 THEN
      UPDATE public.outbound_campaigns
      SET 
        containment_active = true,
        sentinel_status = 'halted',
        status = 'halted'
      WHERE id = NEW.campaign_id;
      
      -- Log to containment
      INSERT INTO public.campaign_containment_log (campaign_id, trigger_type, trigger_reason, auto_triggered)
      VALUES (NEW.campaign_id, 'disclosure_violation_spike', 'Multiple disclosure failures detected', true);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_disclosure_violations ON public.call_disclosure_log;
CREATE TRIGGER trg_check_disclosure_violations
AFTER INSERT ON public.call_disclosure_log
FOR EACH ROW
EXECUTE FUNCTION public.check_disclosure_violations();

-- Trigger to enforce frame writing
CREATE OR REPLACE FUNCTION public.ensure_frame_written()
RETURNS TRIGGER AS $$
BEGIN
  -- When a call session ends, verify frame was written
  IF NEW.status IN ('completed', 'ended', 'failed') AND OLD.status != NEW.status THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.campaign_call_frames 
      WHERE call_session_id = NEW.id
    ) AND NEW.campaign_id IS NOT NULL THEN
      -- Mark frame not written
      NEW.frame_written := false;
      
      -- Log gate violation
      INSERT INTO public.execution_gate_log (
        session_id, campaign_id, campaign_run_id, business_id,
        gate_check_passed, checks_performed, failed_checks, call_blocked, block_reason
      ) VALUES (
        NEW.id, NEW.campaign_id, NEW.campaign_run_id, NEW.business_id,
        false, '["frame_write_check"]', ARRAY['frame_not_written'],
        false, 'Call ended without required frame'
      );
    ELSE
      NEW.frame_written := true;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ensure_frame_written ON public.ai_call_sessions;
CREATE TRIGGER trg_ensure_frame_written
BEFORE UPDATE ON public.ai_call_sessions
FOR EACH ROW
EXECUTE FUNCTION public.ensure_frame_written();

-- ===========================================
-- PART 10: INDEXES FOR PERFORMANCE
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_campaign_runs_campaign ON public.campaign_runs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_runs_status ON public.campaign_runs(status);
CREATE INDEX IF NOT EXISTS idx_disclosure_log_session ON public.call_disclosure_log(session_id);
CREATE INDEX IF NOT EXISTS idx_disclosure_log_failed ON public.call_disclosure_log(disclosure_failed) WHERE disclosure_failed = true;
CREATE INDEX IF NOT EXISTS idx_gate_log_session ON public.execution_gate_log(session_id);
CREATE INDEX IF NOT EXISTS idx_kill_switch_active ON public.kill_switch_state(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sessions_campaign ON public.ai_call_sessions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sessions_test_call ON public.ai_call_sessions(is_test_call) WHERE is_test_call = true;