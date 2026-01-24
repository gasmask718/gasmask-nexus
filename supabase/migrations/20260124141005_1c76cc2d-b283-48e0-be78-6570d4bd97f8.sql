-- ============================================
-- SALES PLAYBOOK & STYLE ATTRIBUTION ENGINE
-- Observational, Auditable, Non-Autonomous
-- ============================================

-- Sales Playbooks: Intent → Structure → Tactics
CREATE TABLE public.sales_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Intent matching
  target_intents TEXT[] NOT NULL DEFAULT '{}', -- e.g., ['order_inquiry', 'pricing_question', 'complaint']
  trigger_keywords TEXT[] DEFAULT '{}',
  
  -- Call structure (phases)
  structure JSONB NOT NULL DEFAULT '[]', -- [{phase: 'greeting', duration_seconds: 30, required: true}, ...]
  
  -- Allowed tactics (what AI CAN do)
  allowed_tactics TEXT[] NOT NULL DEFAULT '{}', -- e.g., ['offer_discount', 'schedule_callback', 'transfer_to_human']
  
  -- Forbidden actions (what AI CANNOT do)
  forbidden_tactics TEXT[] DEFAULT '{}', -- e.g., ['make_price_commitments', 'discuss_legal']
  
  -- Guardrails
  max_duration_seconds INTEGER DEFAULT 300,
  escalation_triggers TEXT[] DEFAULT '{}', -- keywords/conditions that force human handoff
  confidence_floor NUMERIC(3,2) DEFAULT 0.70, -- minimum confidence to continue
  
  -- Performance tracking
  times_used INTEGER DEFAULT 0,
  avg_outcome_score NUMERIC(5,2),
  conversion_rate NUMERIC(5,4),
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Speaker Style Profiles: Tone, Pacing, Phrasing
CREATE TABLE public.speaker_style_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Voice characteristics
  tone TEXT NOT NULL DEFAULT 'professional', -- 'warm', 'professional', 'casual', 'empathetic', 'assertive'
  pacing TEXT DEFAULT 'moderate', -- 'slow', 'moderate', 'fast'
  energy_level TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
  
  -- Phrasing patterns (examples, not templates)
  greeting_examples TEXT[] DEFAULT '{}',
  closing_examples TEXT[] DEFAULT '{}',
  objection_handling_examples TEXT[] DEFAULT '{}',
  empathy_expressions TEXT[] DEFAULT '{}',
  
  -- Style markers (what makes this style distinctive)
  uses_humor BOOLEAN DEFAULT false,
  uses_stories BOOLEAN DEFAULT false,
  uses_questions BOOLEAN DEFAULT true,
  mirroring_enabled BOOLEAN DEFAULT true, -- adapt to caller's style
  
  -- Boundaries (styles influence wording, NOT decisions)
  max_enthusiasm_level INTEGER DEFAULT 7, -- 1-10 scale
  formality_level INTEGER DEFAULT 5, -- 1=casual, 10=formal
  
  -- Attribution
  derived_from_human_id UUID, -- if extracted from a human exemplar
  human_exemplar_calls UUID[] DEFAULT '{}', -- call IDs used to derive this style
  
  -- Performance
  times_used INTEGER DEFAULT 0,
  avg_caller_satisfaction NUMERIC(5,2),
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Call Outcome Scores: Conversion, Satisfaction, Escalation
CREATE TABLE public.call_outcome_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.ai_call_sessions(id) ON DELETE CASCADE,
  call_log_id UUID REFERENCES public.ai_call_logs(id),
  business_id UUID NOT NULL REFERENCES public.businesses(id),
  
  -- Outcome metrics
  conversion_achieved BOOLEAN,
  conversion_type TEXT, -- 'order', 'appointment', 'callback_scheduled', 'info_provided'
  conversion_value NUMERIC(12,2), -- monetary value if applicable
  
  -- Satisfaction signals
  caller_satisfaction_score NUMERIC(3,2), -- 0.00 - 1.00 derived from sentiment
  explicit_feedback TEXT, -- if caller gave feedback
  
  -- Escalation tracking
  escalation_occurred BOOLEAN DEFAULT false,
  escalation_reason TEXT,
  escalation_was_appropriate BOOLEAN, -- human review
  
  -- Efficiency
  call_duration_seconds INTEGER,
  time_to_resolution_seconds INTEGER,
  turns_to_resolution INTEGER,
  
  -- AI performance (if AI participated)
  ai_participated BOOLEAN DEFAULT false,
  ai_confidence_avg NUMERIC(5,4),
  ai_confidence_min NUMERIC(5,4),
  playbook_id UUID REFERENCES public.sales_playbooks(id),
  style_profile_id UUID REFERENCES public.speaker_style_profiles(id),
  playbook_adherence_score NUMERIC(3,2), -- how well AI followed playbook
  
  -- Human performance (for exemplar extraction)
  human_handled BOOLEAN DEFAULT false,
  human_user_id UUID,
  is_exemplar_candidate BOOLEAN DEFAULT false, -- flagged for technique extraction
  
  -- Overall score (composite)
  overall_score NUMERIC(5,2), -- 0-100 composite score
  scoring_version TEXT DEFAULT 'v1',
  
  -- Metadata
  scored_at TIMESTAMPTZ DEFAULT now(),
  scored_by TEXT DEFAULT 'system', -- 'system', 'human_review', 'supervisor'
  review_notes TEXT
);

-- Technique Extractions: Learn from Human Exemplars (POST-CALL ONLY)
CREATE TABLE public.technique_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id),
  source_session_id UUID REFERENCES public.ai_call_sessions(id),
  source_call_log_id UUID REFERENCES public.ai_call_logs(id),
  
  -- Attribution
  human_exemplar_id UUID NOT NULL, -- the human whose technique this is
  human_name TEXT, -- for display
  
  -- Technique details
  technique_type TEXT NOT NULL, -- 'opening', 'objection_handling', 'closing', 'rapport_building', etc.
  technique_name TEXT NOT NULL,
  technique_description TEXT,
  
  -- The actual pattern (sanitized, no PII)
  transcript_excerpt TEXT, -- relevant portion of transcript
  phrasing_pattern TEXT, -- generalized pattern extracted
  context_triggers TEXT[], -- when to use this technique
  
  -- Effectiveness data
  outcome_score NUMERIC(5,2),
  caller_sentiment_after TEXT, -- sentiment after technique was used
  
  -- Validation
  extraction_confidence NUMERIC(3,2), -- how confident the extraction is
  human_validated BOOLEAN DEFAULT false,
  validated_by UUID,
  validated_at TIMESTAMPTZ,
  
  -- Usage
  times_adopted INTEGER DEFAULT 0, -- how often AI has used this
  adoption_success_rate NUMERIC(5,4),
  
  -- Safety
  is_approved_for_ai BOOLEAN DEFAULT false, -- must be explicitly approved
  approval_notes TEXT,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  
  -- Metadata
  extracted_at TIMESTAMPTZ DEFAULT now(),
  extraction_method TEXT DEFAULT 'post_call_analysis' -- NEVER 'live'
);

-- Playbook Usage Log: Track which playbook/style was used per call
CREATE TABLE public.playbook_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.ai_call_sessions(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id),
  
  -- Selection
  playbook_id UUID REFERENCES public.sales_playbooks(id),
  style_profile_id UUID REFERENCES public.speaker_style_profiles(id),
  selection_reason TEXT,
  
  -- State authority check (CRITICAL)
  state_authority_approved BOOLEAN NOT NULL DEFAULT false,
  state_at_selection TEXT, -- call state when selection was made
  speech_was_permitted BOOLEAN NOT NULL DEFAULT false,
  
  -- Outcome link
  outcome_score_id UUID REFERENCES public.call_outcome_scores(id),
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add columns to ai_call_sessions for exemplar tracking
ALTER TABLE public.ai_call_sessions
  ADD COLUMN IF NOT EXISTS human_exemplar_id UUID,
  ADD COLUMN IF NOT EXISTS playbook_id UUID REFERENCES public.sales_playbooks(id),
  ADD COLUMN IF NOT EXISTS style_profile_id UUID REFERENCES public.speaker_style_profiles(id),
  ADD COLUMN IF NOT EXISTS is_exemplar_call BOOLEAN DEFAULT false;

-- Indexes for performance
CREATE INDEX idx_playbooks_business ON public.sales_playbooks(business_id);
CREATE INDEX idx_playbooks_intents ON public.sales_playbooks USING GIN(target_intents);
CREATE INDEX idx_styles_business ON public.speaker_style_profiles(business_id);
CREATE INDEX idx_outcome_scores_session ON public.call_outcome_scores(session_id);
CREATE INDEX idx_outcome_scores_business ON public.call_outcome_scores(business_id);
CREATE INDEX idx_outcome_scores_exemplar ON public.call_outcome_scores(is_exemplar_candidate) WHERE is_exemplar_candidate = true;
CREATE INDEX idx_technique_extractions_business ON public.technique_extractions(business_id);
CREATE INDEX idx_technique_extractions_approved ON public.technique_extractions(is_approved_for_ai) WHERE is_approved_for_ai = true;
CREATE INDEX idx_playbook_usage_session ON public.playbook_usage_log(session_id);

-- RLS
ALTER TABLE public.sales_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speaker_style_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_outcome_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technique_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_usage_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies (service role can do everything, users see their business)
CREATE POLICY "Service role full access to sales_playbooks" 
  ON public.sales_playbooks FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to speaker_style_profiles" 
  ON public.speaker_style_profiles FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to call_outcome_scores" 
  ON public.call_outcome_scores FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to technique_extractions" 
  ON public.technique_extractions FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to playbook_usage_log" 
  ON public.playbook_usage_log FOR ALL USING (true) WITH CHECK (true);

-- Trigger to update timestamps
CREATE TRIGGER update_playbooks_timestamp
  BEFORE UPDATE ON public.sales_playbooks
  FOR EACH ROW EXECUTE FUNCTION public.update_call_state_machine_timestamp();

CREATE TRIGGER update_styles_timestamp
  BEFORE UPDATE ON public.speaker_style_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_call_state_machine_timestamp();