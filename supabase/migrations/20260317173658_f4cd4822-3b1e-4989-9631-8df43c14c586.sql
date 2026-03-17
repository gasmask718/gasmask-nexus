
-- =============================================
-- PHASE 1: Call Intelligence Upgrade
-- =============================================

-- Add intelligence columns to voice agent calls
ALTER TABLE public.brandaro_voice_agent_calls
  ADD COLUMN IF NOT EXISTS call_recording_url TEXT,
  ADD COLUMN IF NOT EXISTS call_transcript TEXT,
  ADD COLUMN IF NOT EXISTS ai_confidence_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_control_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversion_probability NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS improvement_suggestions TEXT[];

-- =============================================
-- PHASE 3: Auto Follow-Up Sequences
-- =============================================

CREATE TABLE IF NOT EXISTS public.brandaro_followup_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.brandaro_qualified_leads(id) ON DELETE CASCADE,
  voice_call_id UUID,
  trigger_event TEXT NOT NULL DEFAULT 'demo_requested',
  sequence_step INTEGER NOT NULL DEFAULT 1,
  channel TEXT NOT NULL DEFAULT 'sms',
  message_content TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  response_received BOOLEAN DEFAULT false,
  response_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brandaro_followup_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read followup sequences"
  ON public.brandaro_followup_sequences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert followup sequences"
  ON public.brandaro_followup_sequences FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update followup sequences"
  ON public.brandaro_followup_sequences FOR UPDATE TO authenticated USING (true);

-- =============================================
-- PHASE 4: Close Pipeline
-- =============================================

CREATE TABLE IF NOT EXISTS public.brandaro_close_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.brandaro_qualified_leads(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'demo_sent',
  assigned_va_id UUID,
  demo_sent_at TIMESTAMPTZ,
  demo_viewed_at TIMESTAMPTZ,
  interested_at TIMESTAMPTZ,
  negotiating_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  lost_reason TEXT,
  payment_amount NUMERIC,
  package_tier TEXT,
  auto_actions_taken TEXT[] DEFAULT '{}',
  priority_score INTEGER DEFAULT 0,
  days_in_pipeline INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brandaro_close_pipeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage close pipeline"
  ON public.brandaro_close_pipeline FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- PHASE 5: Design Intelligence Tracking
-- =============================================

ALTER TABLE public.brandaro_design_profiles
  ADD COLUMN IF NOT EXISTS successful_close_colors JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS successful_close_layouts TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS successful_close_ctas TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS industry_close_rates JSONB DEFAULT '{}';

-- =============================================
-- PHASE 6: Best Call Cloning
-- =============================================

CREATE TABLE IF NOT EXISTS public.brandaro_call_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_call_id UUID,
  pattern_type TEXT NOT NULL,
  opening_style TEXT,
  objection_responses JSONB DEFAULT '{}',
  tone_markers TEXT[] DEFAULT '{}',
  conversion_probability NUMERIC DEFAULT 0,
  times_applied INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brandaro_call_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read call patterns"
  ON public.brandaro_call_patterns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manages call patterns"
  ON public.brandaro_call_patterns FOR ALL TO service_role USING (true);

-- =============================================
-- PHASE 2: VA Action Tracking
-- =============================================

CREATE TABLE IF NOT EXISTS public.brandaro_va_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  va_user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  target_call_id UUID,
  target_lead_id UUID,
  original_value TEXT,
  new_value TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brandaro_va_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage va actions"
  ON public.brandaro_va_actions FOR ALL TO authenticated USING (true) WITH CHECK (true);
