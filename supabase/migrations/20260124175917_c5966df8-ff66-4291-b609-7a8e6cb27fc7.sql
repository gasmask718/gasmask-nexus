-- =====================================================
-- STYLE PROFILES & TECHNIQUE IMITATION SYSTEM
-- AI learns style, not strategy. Tone, not intent.
-- =====================================================

-- ===========================================
-- PART 1: SALES STYLE PROFILES
-- ===========================================

CREATE TABLE IF NOT EXISTS public.sales_style_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  -- Identity
  name TEXT NOT NULL,
  description TEXT,
  
  -- Tone Parameters
  pace TEXT CHECK (pace IN ('slow', 'moderate', 'fast')) DEFAULT 'moderate',
  warmth INTEGER CHECK (warmth >= 1 AND warmth <= 10) DEFAULT 5,
  confidence INTEGER CHECK (confidence >= 1 AND confidence <= 10) DEFAULT 7,
  formality INTEGER CHECK (formality >= 1 AND formality <= 10) DEFAULT 5,
  energy INTEGER CHECK (energy >= 1 AND energy <= 10) DEFAULT 5,
  
  -- Word Choice Parameters
  vocabulary_level TEXT CHECK (vocabulary_level IN ('simple', 'standard', 'professional')) DEFAULT 'standard',
  politeness_markers JSONB DEFAULT '["please", "thank you", "I appreciate"]',
  preferred_phrases JSONB DEFAULT '[]',
  avoided_phrases JSONB DEFAULT '[]',
  
  -- FORBIDDEN OVERLAPS (Hard Constraints)
  forbidden_patterns JSONB NOT NULL DEFAULT '["urgency", "pressure", "manipulation", "false_scarcity"]',
  
  -- Approved Use Cases
  approved_campaign_types TEXT[] DEFAULT ARRAY['product_launch', 'b2b_outreach', 'marketplace_growth'],
  
  -- Human Ownership
  owner_user_id UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  
  -- Approval Status
  is_active BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  
  -- Versioning
  version INTEGER DEFAULT 1,
  previous_version_id UUID REFERENCES public.sales_style_profiles(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- PART 2: TECHNIQUE ATTRIBUTION (LOCKED)
-- ===========================================

CREATE TABLE IF NOT EXISTS public.style_technique_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  style_id UUID NOT NULL REFERENCES public.sales_style_profiles(id) ON DELETE CASCADE,
  
  -- Source Attribution (NON-ANONYMOUS)
  human_coach_id UUID REFERENCES auth.users(id),
  human_coach_name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('call_recording', 'script', 'training_session', 'live_observation')),
  source_reference TEXT, -- URL, file ID, session ID
  
  -- Training Window
  training_start_date DATE NOT NULL,
  training_end_date DATE,
  sample_count INTEGER DEFAULT 0,
  
  -- Signature Hash (Immutable Proof)
  signature_hash TEXT NOT NULL,
  signature_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Notes
  technique_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- PART 3: HUMAN-SIGNED PROMOTION FLOW
-- ===========================================

CREATE TABLE IF NOT EXISTS public.style_promotion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  style_id UUID NOT NULL REFERENCES public.sales_style_profiles(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  -- Request Details
  request_type TEXT NOT NULL CHECK (request_type IN ('activate', 'modify', 'deactivate')),
  requested_changes JSONB, -- Diff of what AI is proposing
  ai_reasoning TEXT,
  simulated_outcomes JSONB, -- Offline test results
  
  -- AI Source
  proposed_by_ai BOOLEAN DEFAULT true,
  ai_agent_id UUID,
  
  -- Human Review
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- Cryptographic Signature
  human_signature_hash TEXT,
  signature_verified BOOLEAN DEFAULT false,
  
  -- Rollback Window
  rollback_window_hours INTEGER DEFAULT 48,
  rollback_expires_at TIMESTAMPTZ,
  was_rolled_back BOOLEAN DEFAULT false,
  rollback_at TIMESTAMPTZ,
  rollback_by UUID REFERENCES auth.users(id),
  rollback_reason TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- PART 4: STYLE BOUNDARY ENFORCEMENT
-- ===========================================

CREATE TABLE IF NOT EXISTS public.style_boundary_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id),
  
  -- Rule Definition
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('allowed', 'forbidden', 'unchanged')),
  applies_to TEXT NOT NULL CHECK (applies_to IN ('disclosure_text', 'permission_question', 'escalation_triggers', 'forbidden_behaviors', 'word_choice', 'sentence_rhythm', 'politeness_markers')),
  
  -- Enforcement
  is_hard_boundary BOOLEAN DEFAULT true,
  violation_action TEXT DEFAULT 'block',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert hard boundary rules
INSERT INTO public.style_boundary_rules (rule_name, rule_type, applies_to, is_hard_boundary, violation_action) VALUES
('disclosure_immutable', 'unchanged', 'disclosure_text', true, 'terminate'),
('permission_immutable', 'unchanged', 'permission_question', true, 'terminate'),
('escalation_immutable', 'unchanged', 'escalation_triggers', true, 'terminate'),
('forbidden_immutable', 'unchanged', 'forbidden_behaviors', true, 'terminate'),
('word_choice_flexible', 'allowed', 'word_choice', false, 'log'),
('rhythm_flexible', 'allowed', 'sentence_rhythm', false, 'log'),
('politeness_flexible', 'allowed', 'politeness_markers', false, 'log')
ON CONFLICT DO NOTHING;

-- ===========================================
-- PART 5: ESCALATION INBOX FOR HUMANS
-- ===========================================

CREATE TABLE IF NOT EXISTS public.human_escalation_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.ai_call_sessions(id),
  campaign_id UUID REFERENCES public.outbound_campaigns(id),
  
  -- Escalation Details
  escalation_reason TEXT NOT NULL,
  escalation_type TEXT NOT NULL CHECK (escalation_type IN ('pricing_request', 'contract_terms', 'legal_trust_authority', 'confidence_drop', 'human_request', 'opt_out', 'other')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  
  -- Context Snapshot
  context_snapshot JSONB NOT NULL DEFAULT '{}',
  transcript_at_escalation TEXT,
  confidence_at_escalation NUMERIC,
  
  -- Caller Info
  caller_phone TEXT,
  caller_name TEXT,
  
  -- SLA Tracking
  escalated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sla_deadline TIMESTAMPTZ,
  sla_breached BOOLEAN DEFAULT false,
  
  -- Human Response
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'scheduled', 'completed', 'expired')),
  accepted_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  declined_reason TEXT,
  
  -- Callback Scheduling
  callback_scheduled_for TIMESTAMPTZ,
  callback_completed BOOLEAN DEFAULT false,
  callback_notes TEXT,
  
  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- PART 6: SPEECH GATE (CORRIDOR LOCK)
-- ===========================================

CREATE TABLE IF NOT EXISTS public.speech_gate_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.ai_call_sessions(id) ON DELETE CASCADE,
  
  -- Gate State
  speech_allowed BOOLEAN NOT NULL DEFAULT false,
  current_phase TEXT CHECK (current_phase IN ('pre_disclosure', 'disclosure', 'permission', 'value_prop', 'conversation', 'blocked', 'terminated')),
  
  -- Tracking
  words_spoken INTEGER DEFAULT 0,
  sentences_spoken INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  
  -- Limits
  max_words INTEGER DEFAULT 45,
  max_sentences INTEGER DEFAULT 2,
  max_duration_ms INTEGER DEFAULT 15000,
  
  -- Violations
  limit_exceeded BOOLEAN DEFAULT false,
  exceeded_at TIMESTAMPTZ,
  termination_reason TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(session_id)
);

-- ===========================================
-- PART 7: OPT-OUT GLOBAL BINDING
-- ===========================================

-- Add global opt-out check function
CREATE OR REPLACE FUNCTION public.check_opt_out_before_call(p_phone TEXT, p_business_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  opt_out_record RECORD;
  result JSONB;
BEGIN
  -- Check for global opt-out first
  SELECT * INTO opt_out_record
  FROM public.outbound_opt_out_registry
  WHERE phone_number = p_phone
    AND is_active = true
    AND (business_id IS NULL OR business_id = p_business_id)
  ORDER BY business_id NULLS FIRST
  LIMIT 1;
  
  IF FOUND THEN
    result := jsonb_build_object(
      'blocked', true,
      'reason', 'opt_out_active',
      'opt_out_method', opt_out_record.opt_out_method,
      'opt_out_date', opt_out_record.created_at,
      'scope', CASE WHEN opt_out_record.business_id IS NULL THEN 'global' ELSE 'business' END
    );
  ELSE
    result := jsonb_build_object('blocked', false);
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- PART 8: ENABLE RLS
-- ===========================================

ALTER TABLE public.sales_style_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.style_technique_attribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.style_promotion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.style_boundary_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_escalation_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speech_gate_state ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated can view style profiles" ON public.sales_style_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can view technique attribution" ON public.style_technique_attribution FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can view promotion requests" ON public.style_promotion_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can view boundary rules" ON public.style_boundary_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can view escalation inbox" ON public.human_escalation_inbox FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can view speech gate" ON public.speech_gate_state FOR SELECT TO authenticated USING (true);

-- ===========================================
-- PART 9: INDEXES
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_style_profiles_business ON public.sales_style_profiles(business_id);
CREATE INDEX IF NOT EXISTS idx_style_profiles_active ON public.sales_style_profiles(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_escalation_inbox_status ON public.human_escalation_inbox(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_escalation_inbox_business ON public.human_escalation_inbox(business_id);
CREATE INDEX IF NOT EXISTS idx_speech_gate_session ON public.speech_gate_state(session_id);