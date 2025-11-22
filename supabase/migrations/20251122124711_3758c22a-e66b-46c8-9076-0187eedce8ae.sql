-- Create deal_sheets table
CREATE TABLE public.deal_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads_raw(id),
  acquisition_id UUID REFERENCES public.acquisitions_pipeline(id),
  title TEXT NOT NULL,
  summary TEXT,
  pdf_url TEXT,
  email_template TEXT,
  sms_template TEXT,
  social_media_copy TEXT,
  investor_pitch_deck_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  views_count INTEGER DEFAULT 0,
  downloads_count INTEGER DEFAULT 0
);

-- Create investor_email_logs table
CREATE TABLE public.investor_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_sheet_id UUID REFERENCES public.deal_sheets(id),
  investor_id UUID,
  investor_email TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  response_type TEXT,
  interest_level TEXT,
  notes TEXT
);

-- Create marketing_engines table
CREATE TABLE public.marketing_engines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  performance_metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create investor_engagement table
CREATE TABLE public.investor_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL,
  deal_sheet_id UUID REFERENCES public.deal_sheets(id),
  engagement_type TEXT NOT NULL,
  engagement_score INTEGER DEFAULT 0,
  last_interaction_at TIMESTAMPTZ DEFAULT now(),
  total_interactions INTEGER DEFAULT 1,
  interested BOOLEAN DEFAULT false,
  declined BOOLEAN DEFAULT false,
  offer_amount NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.deal_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_engines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_engagement ENABLE ROW LEVEL SECURITY;

-- deal_sheets policies
CREATE POLICY "Admins manage deal_sheets"
  ON public.deal_sheets
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System insert deal_sheets"
  ON public.deal_sheets
  FOR INSERT
  WITH CHECK (true);

-- investor_email_logs policies
CREATE POLICY "Admins manage email_logs"
  ON public.investor_email_logs
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System insert email_logs"
  ON public.investor_email_logs
  FOR INSERT
  WITH CHECK (true);

-- marketing_engines policies
CREATE POLICY "Admins manage marketing_engines"
  ON public.marketing_engines
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- investor_engagement policies
CREATE POLICY "Admins manage investor_engagement"
  ON public.investor_engagement
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System insert investor_engagement"
  ON public.investor_engagement
  FOR INSERT
  WITH CHECK (true);

-- Indexes
CREATE INDEX idx_deal_sheets_lead ON public.deal_sheets(lead_id);
CREATE INDEX idx_deal_sheets_acquisition ON public.deal_sheets(acquisition_id);
CREATE INDEX idx_email_logs_deal_sheet ON public.investor_email_logs(deal_sheet_id);
CREATE INDEX idx_email_logs_investor ON public.investor_email_logs(investor_id);
CREATE INDEX idx_investor_engagement_investor ON public.investor_engagement(investor_id);
CREATE INDEX idx_investor_engagement_deal ON public.investor_engagement(deal_sheet_id);