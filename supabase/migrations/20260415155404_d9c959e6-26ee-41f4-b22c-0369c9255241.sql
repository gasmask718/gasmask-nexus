
-- ============================================
-- DYNASTY AI CALL CENTER SCHEMA
-- ============================================

-- Main calls table
CREATE TABLE public.dynasty_ai_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id text UNIQUE NOT NULL,
  business_unit text NOT NULL,
  agent_id text NOT NULL,
  agent_name text,
  direction text DEFAULT 'outbound',
  from_number text,
  to_number text,
  contact_name text,
  company_name text,
  transcript text,
  recording_url text,
  duration_seconds integer,
  outcome text,
  lead_quality text,
  next_action text,
  cost_cents integer,
  estimated_deal_value_cents integer,
  assigned_closer_id uuid,
  assigned_at timestamptz,
  call_started_at timestamptz,
  call_ended_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- AI Analysis table
CREATE TABLE public.dynasty_call_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id text UNIQUE REFERENCES public.dynasty_ai_calls(call_id) ON DELETE CASCADE,
  overall_score integer,
  rapport_score integer,
  objection_handling_score integer,
  qualification_score integer,
  closing_score integer,
  energy_score integer,
  what_went_well text[],
  what_to_improve text[],
  missed_opportunities text[],
  best_moment text,
  worst_moment text,
  specific_coaching text,
  script_adherence_percentage integer,
  talk_to_listen_ratio integer,
  objections_raised text[],
  objection_handling_grade text,
  objection_handling_notes text,
  recommended_followup text,
  callback_timing text,
  suggested_talking_points text[],
  customer_sentiment text,
  rep_sentiment text,
  key_moments jsonb,
  analysis_version text DEFAULT 'v1',
  claude_model text DEFAULT 'claude-sonnet-4-20250514',
  analysis_cost_cents integer,
  analyzed_at timestamptz DEFAULT now()
);

-- Performer tracking
CREATE TABLE public.dynasty_call_performers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  full_name text NOT NULL,
  role text NOT NULL,
  business_units text[],
  total_calls integer DEFAULT 0,
  total_talk_time_seconds integer DEFAULT 0,
  average_call_score decimal(3,1),
  qualification_rate decimal(5,2),
  close_rate decimal(5,2),
  total_commissions_cents integer DEFAULT 0,
  pending_commissions_cents integer DEFAULT 0,
  is_active boolean DEFAULT true,
  hired_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Lead pipeline
CREATE TABLE public.dynasty_lead_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id text REFERENCES public.dynasty_ai_calls(call_id),
  business_unit text NOT NULL,
  contact_name text,
  company_name text,
  phone_number text,
  email text,
  budget_range text,
  timeline text,
  decision_maker boolean,
  pain_points text[],
  assigned_closer_id uuid REFERENCES public.dynasty_call_performers(id),
  assigned_at timestamptz,
  stage text DEFAULT 'new',
  last_contact_at timestamptz,
  next_followup_at timestamptz,
  quoted_price_cents integer,
  actual_price_cents integer,
  won_at timestamptz,
  lost_at timestamptz,
  lost_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Objection library
CREATE TABLE public.dynasty_objection_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit text NOT NULL,
  objection_text text NOT NULL,
  objection_category text,
  successful_responses text[],
  unsuccessful_responses text[],
  times_encountered integer DEFAULT 1,
  times_overcome integer DEFAULT 0,
  success_rate decimal(5,2),
  recommended_response text,
  first_seen_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now()
);

-- Call campaigns
CREATE TABLE public.dynasty_call_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name text NOT NULL,
  business_unit text NOT NULL,
  agent_id text NOT NULL,
  total_leads integer,
  leads_remaining integer,
  lead_source text,
  calls_made integer DEFAULT 0,
  qualified_leads integer DEFAULT 0,
  callbacks_scheduled integer DEFAULT 0,
  total_cost_cents integer DEFAULT 0,
  cost_per_qualified_lead_cents integer,
  status text DEFAULT 'active',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- VALIDATION TRIGGERS (replacing CHECK constraints)
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_call_analysis_scores()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.overall_score IS NOT NULL AND (NEW.overall_score < 0 OR NEW.overall_score > 10) THEN
    RAISE EXCEPTION 'overall_score must be between 0 and 10';
  END IF;
  IF NEW.rapport_score IS NOT NULL AND (NEW.rapport_score < 0 OR NEW.rapport_score > 10) THEN
    RAISE EXCEPTION 'rapport_score must be between 0 and 10';
  END IF;
  IF NEW.objection_handling_score IS NOT NULL AND (NEW.objection_handling_score < 0 OR NEW.objection_handling_score > 10) THEN
    RAISE EXCEPTION 'objection_handling_score must be between 0 and 10';
  END IF;
  IF NEW.qualification_score IS NOT NULL AND (NEW.qualification_score < 0 OR NEW.qualification_score > 10) THEN
    RAISE EXCEPTION 'qualification_score must be between 0 and 10';
  END IF;
  IF NEW.closing_score IS NOT NULL AND (NEW.closing_score < 0 OR NEW.closing_score > 10) THEN
    RAISE EXCEPTION 'closing_score must be between 0 and 10';
  END IF;
  IF NEW.energy_score IS NOT NULL AND (NEW.energy_score < 0 OR NEW.energy_score > 10) THEN
    RAISE EXCEPTION 'energy_score must be between 0 and 10';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_analysis_scores
BEFORE INSERT OR UPDATE ON public.dynasty_call_analysis
FOR EACH ROW EXECUTE FUNCTION public.validate_call_analysis_scores();

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION public.update_dynasty_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_dynasty_ai_calls_updated_at
BEFORE UPDATE ON public.dynasty_ai_calls
FOR EACH ROW EXECUTE FUNCTION public.update_dynasty_updated_at();

CREATE TRIGGER update_dynasty_call_performers_updated_at
BEFORE UPDATE ON public.dynasty_call_performers
FOR EACH ROW EXECUTE FUNCTION public.update_dynasty_updated_at();

CREATE TRIGGER update_dynasty_lead_pipeline_updated_at
BEFORE UPDATE ON public.dynasty_lead_pipeline
FOR EACH ROW EXECUTE FUNCTION public.update_dynasty_updated_at();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_dynasty_calls_business_unit ON public.dynasty_ai_calls(business_unit);
CREATE INDEX idx_dynasty_calls_outcome ON public.dynasty_ai_calls(outcome);
CREATE INDEX idx_dynasty_calls_date ON public.dynasty_ai_calls(call_started_at DESC);
CREATE INDEX idx_dynasty_calls_assigned_closer ON public.dynasty_ai_calls(assigned_closer_id);
CREATE INDEX idx_dynasty_analysis_overall_score ON public.dynasty_call_analysis(overall_score DESC);
CREATE INDEX idx_dynasty_analysis_call_id ON public.dynasty_call_analysis(call_id);
CREATE INDEX idx_dynasty_pipeline_stage ON public.dynasty_lead_pipeline(stage);
CREATE INDEX idx_dynasty_pipeline_closer ON public.dynasty_lead_pipeline(assigned_closer_id);
CREATE INDEX idx_dynasty_pipeline_next_followup ON public.dynasty_lead_pipeline(next_followup_at);
CREATE INDEX idx_dynasty_objections_business ON public.dynasty_objection_library(business_unit);
CREATE INDEX idx_dynasty_objections_category ON public.dynasty_objection_library(objection_category);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.dynasty_ai_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynasty_call_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynasty_call_performers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynasty_lead_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynasty_objection_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynasty_call_campaigns ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all call center data
CREATE POLICY "Authenticated users can view calls"
ON public.dynasty_ai_calls FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert calls"
ON public.dynasty_ai_calls FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update calls"
ON public.dynasty_ai_calls FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view analysis"
ON public.dynasty_call_analysis FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert analysis"
ON public.dynasty_call_analysis FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update analysis"
ON public.dynasty_call_analysis FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view performers"
ON public.dynasty_call_performers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert performers"
ON public.dynasty_call_performers FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update performers"
ON public.dynasty_call_performers FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view pipeline"
ON public.dynasty_lead_pipeline FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert pipeline"
ON public.dynasty_lead_pipeline FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update pipeline"
ON public.dynasty_lead_pipeline FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view objections"
ON public.dynasty_objection_library FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert objections"
ON public.dynasty_objection_library FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update objections"
ON public.dynasty_objection_library FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view campaigns"
ON public.dynasty_call_campaigns FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert campaigns"
ON public.dynasty_call_campaigns FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update campaigns"
ON public.dynasty_call_campaigns FOR UPDATE TO authenticated USING (true);

-- Enable realtime for live call monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE public.dynasty_ai_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dynasty_call_analysis;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dynasty_lead_pipeline;
