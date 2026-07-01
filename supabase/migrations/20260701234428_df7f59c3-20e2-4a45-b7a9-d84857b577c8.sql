CREATE TABLE public.dc_lead_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id text NOT NULL,
  business_unit_key text NOT NULL REFERENCES public.dc_businesses(business_key) ON DELETE CASCADE,
  lead_id uuid NOT NULL,
  source_table text NOT NULL,
  interest_level text,
  interest_score integer,
  sentiment text,
  recommended_action text,
  opted_out boolean DEFAULT false,
  callback_requested boolean DEFAULT false,
  callback_time text,
  contact_confirmed boolean,
  summary text,
  key_objections jsonb DEFAULT '[]'::jsonb,
  red_flags jsonb DEFAULT '[]'::jsonb,
  email_provided text,
  qualification_payload jsonb DEFAULT '{}'::jsonb,
  analysis_version text DEFAULT 'v1',
  claude_model text,
  analyzed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.dc_lead_analysis TO authenticated;
GRANT ALL ON public.dc_lead_analysis TO service_role;

CREATE UNIQUE INDEX idx_dc_lead_analysis_call_id ON public.dc_lead_analysis(call_id);
CREATE INDEX idx_dc_lead_analysis_lead ON public.dc_lead_analysis(lead_id);
CREATE INDEX idx_dc_lead_analysis_buk ON public.dc_lead_analysis(business_unit_key, analyzed_at DESC);
CREATE INDEX idx_dc_lead_analysis_action ON public.dc_lead_analysis(recommended_action) WHERE recommended_action IS NOT NULL;

ALTER TABLE public.dc_lead_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY dc_lead_analysis_select ON public.dc_lead_analysis
  FOR SELECT TO authenticated USING (true);

CREATE POLICY dc_lead_analysis_service ON public.dc_lead_analysis
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.dc_lead_analysis IS
'Per-call lead qualification output from dc-post-call-analysis. Complements dynasty_call_analysis (rep performance) with lead-side intelligence. Join key: dc_lead_analysis.call_id = dc_call_logs.call_sid = dynasty_ai_calls.call_id';