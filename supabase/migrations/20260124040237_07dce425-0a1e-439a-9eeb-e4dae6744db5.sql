-- =============================================
-- LIVE MODE GOVERNANCE, AUDIT & KILL SWITCHES
-- Authority layer for AI Call Agent Live Mode
-- =============================================

-- Live Mode Authorization Records (explicit admin approval required)
CREATE TABLE public.ai_live_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  route_id TEXT, -- Optional route identifier (not FK)
  
  -- Authorization details
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'revoked', 'expired', 'suspended')),
  authorized_by UUID REFERENCES auth.users(id),
  authorized_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  
  -- Justification & evidence
  justification TEXT NOT NULL,
  evidence_snapshot JSONB NOT NULL DEFAULT '{}',
  trust_score_at_approval NUMERIC(5,2),
  accuracy_rate_at_approval NUMERIC(5,2),
  canary_days_completed INTEGER DEFAULT 0,
  canary_calls_evaluated INTEGER DEFAULT 0,
  
  -- Expiration (recommended)
  expires_at TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_live_authorizations ENABLE ROW LEVEL SECURITY;

-- Audit Events (append-only, immutable)
CREATE TABLE public.ai_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.ai_call_sessions(id) ON DELETE SET NULL,
  authorization_id UUID REFERENCES public.ai_live_authorizations(id) ON DELETE SET NULL,
  
  -- Event classification
  event_type TEXT NOT NULL CHECK (event_type IN (
    'call_entry', 'call_checkpoint', 'call_exit',
    'mode_change', 'authorization_granted', 'authorization_revoked',
    'kill_switch_activated', 'kill_switch_deactivated',
    'auto_suspension', 'manual_suspension',
    'human_override', 'escalation', 'failure',
    'trust_score_update', 'threshold_breach'
  )),
  event_severity TEXT NOT NULL DEFAULT 'info' CHECK (event_severity IN ('info', 'warning', 'critical', 'emergency')),
  
  -- Event data
  event_payload JSONB NOT NULL DEFAULT '{}',
  trust_score_at_event NUMERIC(5,2),
  confidence_at_event NUMERIC(5,2),
  transcript_snapshot TEXT,
  
  -- Actor tracking
  triggered_by TEXT,
  actor_user_id UUID REFERENCES auth.users(id),
  
  -- Immutability marker
  is_immutable BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_audit_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_audit_events_business_time ON public.ai_audit_events(business_id, created_at DESC);
CREATE INDEX idx_audit_events_session ON public.ai_audit_events(session_id, created_at);
CREATE INDEX idx_audit_events_type ON public.ai_audit_events(event_type, created_at DESC);

-- Kill Switch State (multi-level)
CREATE TABLE public.ai_kill_switch_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('global', 'business', 'route')),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  route_id TEXT, -- Optional route identifier
  
  is_active BOOLEAN NOT NULL DEFAULT false,
  activated_at TIMESTAMPTZ,
  activated_by UUID REFERENCES auth.users(id),
  activation_reason TEXT,
  
  auto_deactivate_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_kill_switch_state ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_unique_global_kill_switch ON public.ai_kill_switch_state(scope) WHERE scope = 'global';
CREATE UNIQUE INDEX idx_unique_business_kill_switch ON public.ai_kill_switch_state(business_id) WHERE scope = 'business' AND business_id IS NOT NULL;
CREATE UNIQUE INDEX idx_unique_route_kill_switch ON public.ai_kill_switch_state(route_id) WHERE scope = 'route' AND route_id IS NOT NULL;
CREATE INDEX idx_kill_switch_active ON public.ai_kill_switch_state(is_active, scope);

-- Insert global kill switch record
INSERT INTO public.ai_kill_switch_state (scope, is_active) VALUES ('global', false);

-- RLS Policies
CREATE POLICY "Admins can manage authorizations" ON public.ai_live_authorizations FOR ALL USING (true);
CREATE POLICY "Anyone can read audit events" ON public.ai_audit_events FOR SELECT USING (true);
CREATE POLICY "System can insert audit events" ON public.ai_audit_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read kill switch state" ON public.ai_kill_switch_state FOR SELECT USING (true);
CREATE POLICY "Admins can manage kill switches" ON public.ai_kill_switch_state FOR ALL USING (true);

-- Function to check if Live Mode is authorized
CREATE OR REPLACE FUNCTION public.is_live_mode_authorized(
  p_business_id UUID,
  p_route_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_global_kill BOOLEAN;
  v_business_kill BOOLEAN;
  v_route_kill BOOLEAN;
  v_authorization_valid BOOLEAN;
BEGIN
  SELECT is_active INTO v_global_kill FROM ai_kill_switch_state WHERE scope = 'global' LIMIT 1;
  IF v_global_kill = true THEN RETURN false; END IF;
  
  SELECT is_active INTO v_business_kill FROM ai_kill_switch_state WHERE scope = 'business' AND business_id = p_business_id LIMIT 1;
  IF v_business_kill = true THEN RETURN false; END IF;
  
  IF p_route_id IS NOT NULL THEN
    SELECT is_active INTO v_route_kill FROM ai_kill_switch_state WHERE scope = 'route' AND route_id = p_route_id LIMIT 1;
    IF v_route_kill = true THEN RETURN false; END IF;
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM ai_live_authorizations
    WHERE business_id = p_business_id
    AND status = 'approved'
    AND (expires_at IS NULL OR expires_at > now())
    AND (route_id IS NULL OR route_id = p_route_id)
  ) INTO v_authorization_valid;
  
  RETURN v_authorization_valid;
END;
$$;

-- Function to log audit events
CREATE OR REPLACE FUNCTION public.log_ai_audit_event(
  p_business_id UUID,
  p_event_type TEXT,
  p_event_severity TEXT DEFAULT 'info',
  p_session_id UUID DEFAULT NULL,
  p_authorization_id UUID DEFAULT NULL,
  p_event_payload JSONB DEFAULT '{}',
  p_trust_score NUMERIC DEFAULT NULL,
  p_confidence NUMERIC DEFAULT NULL,
  p_transcript_snapshot TEXT DEFAULT NULL,
  p_triggered_by TEXT DEFAULT 'system',
  p_actor_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO ai_audit_events (
    business_id, session_id, authorization_id,
    event_type, event_severity, event_payload,
    trust_score_at_event, confidence_at_event, transcript_snapshot,
    triggered_by, actor_user_id
  ) VALUES (
    p_business_id, p_session_id, p_authorization_id,
    p_event_type, p_event_severity, p_event_payload,
    p_trust_score, p_confidence, p_transcript_snapshot,
    p_triggered_by, p_actor_user_id
  )
  RETURNING id INTO v_event_id;
  RETURN v_event_id;
END;
$$;

-- Enable realtime for kill switch state
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_kill_switch_state;