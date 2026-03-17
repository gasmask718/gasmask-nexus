
-- Client reports (periodic performance snapshots)
CREATE TABLE IF NOT EXISTS public.brandaro_client_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.brandaro_leads_master(id) ON DELETE CASCADE,
  period TEXT NOT NULL DEFAULT 'monthly',
  period_start DATE,
  period_end DATE,
  visitors INTEGER DEFAULT 0,
  leads_generated INTEGER DEFAULT 0,
  calls_generated INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue_estimate NUMERIC DEFAULT 0,
  growth_pct NUMERIC DEFAULT 0,
  highlights TEXT[],
  report_url TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.brandaro_client_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage client reports" ON public.brandaro_client_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- AI Account Manager state
CREATE TABLE IF NOT EXISTS public.brandaro_ai_account_manager (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.brandaro_leads_master(id) ON DELETE CASCADE UNIQUE,
  last_message TEXT,
  last_action TEXT,
  last_contact_at TIMESTAMPTZ DEFAULT now(),
  satisfaction_score INTEGER DEFAULT 70,
  engagement_level TEXT DEFAULT 'medium',
  auto_messages_sent INTEGER DEFAULT 0,
  next_scheduled_action TEXT,
  next_scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.brandaro_ai_account_manager ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage ai account manager" ON public.brandaro_ai_account_manager FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Ads campaigns tracking
CREATE TABLE IF NOT EXISTS public.brandaro_ads_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.brandaro_leads_master(id) ON DELETE CASCADE,
  platform TEXT DEFAULT 'google',
  budget NUMERIC DEFAULT 0,
  spend NUMERIC DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  leads_generated INTEGER DEFAULT 0,
  cost_per_lead NUMERIC DEFAULT 0,
  revenue_attributed NUMERIC DEFAULT 0,
  roi_pct NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.brandaro_ads_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage ads campaigns" ON public.brandaro_ads_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);
