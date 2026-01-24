-- =====================================================
-- LOCKED OPENING CORRIDOR SYSTEM
-- Non-bypassable, hash-verified, auditable disclosure & permission gates
-- =====================================================

-- ===========================================
-- PART 1: APPROVED DISCLOSURE TEMPLATES
-- Hash-verified, immutable disclosure texts
-- ===========================================

CREATE TABLE IF NOT EXISTS public.approved_disclosures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  disclosure_text TEXT NOT NULL,
  disclosure_hash TEXT NOT NULL, -- SHA-256 hash of disclosure text
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(business_id, version)
);

-- ===========================================
-- PART 2: OPENING CORRIDOR STATE TRACKING
-- Per-call corridor progression
-- ===========================================

CREATE TABLE IF NOT EXISTS public.opening_corridor_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.ai_call_sessions(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.outbound_campaigns(id),
  business_id UUID NOT NULL REFERENCES public.businesses(id),
  
  -- Phase A: Disclosure
  phase_a_started_at TIMESTAMPTZ,
  phase_a_completed_at TIMESTAMPTZ,
  disclosure_text_used TEXT,
  disclosure_hash_verified BOOLEAN DEFAULT false,
  disclosure_hash_expected TEXT,
  disclosure_hash_actual TEXT,
  disclosure_interrupted BOOLEAN DEFAULT false,
  disclosure_retry_count INTEGER DEFAULT 0,
  
  -- Phase B: Permission Gate
  phase_b_started_at TIMESTAMPTZ,
  phase_b_completed_at TIMESTAMPTZ,
  permission_question_asked TEXT,
  permission_response TEXT CHECK (permission_response IN ('permission_granted', 'permission_denied', 'uncertain', 'no_response', NULL)),
  permission_response_raw TEXT,
  
  -- Phase C: Value Proposition
  phase_c_started_at TIMESTAMPTZ,
  phase_c_completed_at TIMESTAMPTZ,
  value_prop_sentence_id TEXT,
  value_prop_text TEXT,
  value_prop_word_count INTEGER,
  
  -- Speech Limits Tracking
  pre_permission_words INTEGER DEFAULT 0,
  pre_permission_sentences INTEGER DEFAULT 0,
  pre_permission_duration_ms INTEGER DEFAULT 0,
  speech_limit_exceeded BOOLEAN DEFAULT false,
  speech_limit_violation_type TEXT,
  
  -- Corridor Status
  corridor_status TEXT NOT NULL DEFAULT 'pending' CHECK (corridor_status IN (
    'pending', 'phase_a_active', 'phase_a_complete', 
    'phase_b_active', 'phase_b_complete', 
    'phase_c_active', 'corridor_passed', 
    'blocked_disclosure_failure', 'blocked_permission_denied',
    'blocked_speech_limit', 'blocked_hash_mismatch',
    'terminated_no_response', 'terminated_violation'
  )),
  corridor_passed BOOLEAN DEFAULT false,
  corridor_blocked_reason TEXT,
  
  -- Timing
  total_corridor_duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(session_id)
);

-- ===========================================
-- PART 3: ESCALATION TRIGGERS & LOG
-- ===========================================

CREATE TABLE IF NOT EXISTS public.escalation_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'pricing_requested', 'contract_mentioned', 'legal_objection',
    'trust_objection', 'authority_objection', 'confidence_breach',
    'human_requested', 'forbidden_topic', 'opt_out_request'
  )),
  trigger_keywords TEXT[],
  confidence_threshold NUMERIC(3,2),
  is_active BOOLEAN DEFAULT true,
  auto_escalate BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default escalation triggers
INSERT INTO public.escalation_triggers (trigger_type, trigger_keywords, confidence_threshold, is_active, auto_escalate) VALUES
('pricing_requested', ARRAY['price', 'cost', 'how much', 'rate', 'fee', 'pricing', 'quote', 'discount'], NULL, true, true),
('contract_mentioned', ARRAY['contract', 'agreement', 'terms', 'sign', 'legal', 'binding', 'commitment'], NULL, true, true),
('legal_objection', ARRAY['lawyer', 'attorney', 'sue', 'legal action', 'not allowed', 'regulation'], NULL, true, true),
('trust_objection', ARRAY['scam', 'fraud', 'dont trust', 'not legitimate', 'prove it', 'suspicious'], NULL, true, true),
('authority_objection', ARRAY['not my decision', 'need to ask', 'talk to my', 'manager', 'owner decides', 'boss'], NULL, true, true),
('confidence_breach', NULL, 0.65, true, true),
('human_requested', ARRAY['real person', 'human', 'speak to someone', 'representative', 'not a robot', 'actual person'], NULL, true, true),
('opt_out_request', ARRAY['stop calling', 'do not call', 'remove me', 'unsubscribe', 'opt out', 'take me off'], NULL, true, true)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.call_escalation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.ai_call_sessions(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.outbound_campaigns(id),
  corridor_id UUID REFERENCES public.opening_corridor_state(id),
  trigger_type TEXT NOT NULL,
  trigger_details JSONB,
  confidence_at_escalation NUMERIC(3,2),
  transcript_snippet TEXT,
  escalated_to_user_id UUID REFERENCES auth.users(id),
  escalation_status TEXT DEFAULT 'pending' CHECK (escalation_status IN ('pending', 'accepted', 'declined', 'timeout', 'bridged', 'scheduled')),
  human_response_at TIMESTAMPTZ,
  call_bridged BOOLEAN DEFAULT false,
  followup_scheduled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- PART 4: FORBIDDEN BEHAVIORS REGISTRY
-- Runtime enforcement
-- ===========================================

CREATE TABLE IF NOT EXISTS public.forbidden_ai_behaviors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  behavior_code TEXT NOT NULL UNIQUE,
  behavior_description TEXT NOT NULL,
  detection_patterns TEXT[],
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'violation', 'critical')),
  auto_terminate BOOLEAN DEFAULT false,
  trigger_kill_switch BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert forbidden behaviors
INSERT INTO public.forbidden_ai_behaviors (behavior_code, behavior_description, detection_patterns, severity, auto_terminate, trigger_kill_switch) VALUES
('NEGOTIATE_PRICING', 'AI attempted to negotiate or discuss pricing', ARRAY['I can offer', 'special price', 'discount for you', 'lower the price', 'make a deal'], 'critical', true, false),
('PROMISE_OUTCOMES', 'AI made outcome guarantees', ARRAY['guarantee', 'promise you', 'definitely will', 'for sure', '100%', 'certain to'], 'critical', true, false),
('CREATE_URGENCY', 'AI used urgency tactics', ARRAY['limited time', 'act now', 'today only', 'expires', 'running out', 'last chance', 'hurry'], 'critical', true, false),
('COMPARE_COMPETITORS', 'AI compared against competitors', ARRAY['better than', 'unlike them', 'competitor', 'other companies', 'they dont', 'we beat'], 'violation', true, false),
('CONTINUE_AFTER_OPTOUT', 'AI continued after opt-out request', NULL, 'critical', true, true),
('SPEAK_WITHOUT_DISCLOSURE', 'AI spoke value proposition before disclosure', NULL, 'critical', true, true),
('IGNORE_KILL_SWITCH', 'AI continued during kill switch', NULL, 'critical', true, true),
('EXCEED_SPEECH_LIMIT', 'AI exceeded pre-permission speech limits', NULL, 'violation', true, false)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.behavior_violation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.ai_call_sessions(id),
  campaign_id UUID REFERENCES public.outbound_campaigns(id),
  corridor_id UUID REFERENCES public.opening_corridor_state(id),
  behavior_code TEXT NOT NULL,
  detected_text TEXT,
  detection_confidence NUMERIC(3,2),
  action_taken TEXT,
  call_terminated BOOLEAN DEFAULT false,
  kill_switch_triggered BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- PART 5: SPEECH LIMITS CONFIGURATION
-- ===========================================

CREATE TABLE IF NOT EXISTS public.speech_limit_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id),
  -- Pre-permission limits (HARD)
  max_words_before_permission INTEGER NOT NULL DEFAULT 45,
  max_sentences_before_permission INTEGER NOT NULL DEFAULT 2,
  max_duration_ms_before_permission INTEGER NOT NULL DEFAULT 15000,
  -- Value prop limits
  max_value_prop_sentences INTEGER NOT NULL DEFAULT 1,
  max_value_prop_words INTEGER NOT NULL DEFAULT 25,
  -- Enforcement
  enforce_strictly BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(business_id)
);

-- Insert default global config
INSERT INTO public.speech_limit_config (max_words_before_permission, max_sentences_before_permission, max_duration_ms_before_permission, max_value_prop_sentences, max_value_prop_words)
VALUES (45, 2, 15000, 1, 25)
ON CONFLICT DO NOTHING;

-- ===========================================
-- PART 6: EXTEND AI_CALL_SESSIONS
-- ===========================================

ALTER TABLE public.ai_call_sessions
ADD COLUMN IF NOT EXISTS corridor_passed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS corridor_id UUID,
ADD COLUMN IF NOT EXISTS permission_granted BOOLEAN,
ADD COLUMN IF NOT EXISTS permission_granted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS escalated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS escalation_reason TEXT;

-- ===========================================
-- PART 7: CORRIDOR AUDIT FRAME EXTENSION
-- ===========================================

ALTER TABLE public.campaign_call_frames
ADD COLUMN IF NOT EXISTS corridor_passed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS permission_granted BOOLEAN,
ADD COLUMN IF NOT EXISTS time_to_permission_ms INTEGER,
ADD COLUMN IF NOT EXISTS playbook_sentence_id TEXT,
ADD COLUMN IF NOT EXISTS escalation_decision TEXT,
ADD COLUMN IF NOT EXISTS disclosure_hash TEXT,
ADD COLUMN IF NOT EXISTS speech_limit_compliant BOOLEAN DEFAULT true;

-- ===========================================
-- PART 8: ENABLE RLS
-- ===========================================

ALTER TABLE public.approved_disclosures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opening_corridor_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_escalation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forbidden_ai_behaviors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavior_violation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speech_limit_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view approved disclosures" ON public.approved_disclosures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view corridor state" ON public.opening_corridor_state FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view escalation triggers" ON public.escalation_triggers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view escalation log" ON public.call_escalation_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view forbidden behaviors" ON public.forbidden_ai_behaviors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view violation log" ON public.behavior_violation_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view speech limits" ON public.speech_limit_config FOR SELECT TO authenticated USING (true);

-- ===========================================
-- PART 9: ASSERTIONS
-- ===========================================

INSERT INTO public.execution_audit_assertions (assertion_name, assertion_query, is_critical, auto_halt_on_violation) VALUES
('no_frame_without_disclosure', 'SELECT NOT EXISTS (SELECT 1 FROM campaign_call_frames WHERE corridor_passed = false AND disclosure_spoken = false)', true, true),
('no_value_prop_before_permission', 'SELECT NOT EXISTS (SELECT 1 FROM opening_corridor_state WHERE phase_c_completed_at IS NOT NULL AND permission_response != ''permission_granted'')', true, true),
('no_live_without_human_fallback', 'SELECT NOT EXISTS (SELECT 1 FROM outbound_campaigns oc WHERE status = ''active'' AND execution_mode = ''live'' AND NOT EXISTS (SELECT 1 FROM call_routing_rules crr WHERE crr.business_id = oc.business_id AND crr.is_active = true))', true, true)
ON CONFLICT DO NOTHING;

-- ===========================================
-- PART 10: INDEXES
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_corridor_session ON public.opening_corridor_state(session_id);
CREATE INDEX IF NOT EXISTS idx_corridor_status ON public.opening_corridor_state(corridor_status);
CREATE INDEX IF NOT EXISTS idx_corridor_passed ON public.opening_corridor_state(corridor_passed) WHERE corridor_passed = true;
CREATE INDEX IF NOT EXISTS idx_escalation_session ON public.call_escalation_log(session_id);
CREATE INDEX IF NOT EXISTS idx_violation_session ON public.behavior_violation_log(session_id);
CREATE INDEX IF NOT EXISTS idx_approved_disclosure_active ON public.approved_disclosures(business_id, is_active) WHERE is_active = true;