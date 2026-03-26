
-- UT Partner Leads (recruitment CRM)
CREATE TABLE public.ut_partner_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_name TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  phone TEXT,
  email TEXT,
  city TEXT,
  state TEXT,
  source TEXT DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'new',
  assigned_to UUID REFERENCES auth.users(id),
  ai_score INTEGER DEFAULT 0,
  ai_score_reasons JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  onboarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- UT Outreach Logs
CREATE TABLE public.ut_outreach_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.ut_partner_leads(id) ON DELETE CASCADE NOT NULL,
  channel TEXT NOT NULL DEFAULT 'call',
  outcome TEXT NOT NULL DEFAULT 'no_answer',
  notes TEXT,
  performed_by UUID REFERENCES auth.users(id),
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- UT Partner Profiles (onboarded vendors)
CREATE TABLE public.ut_partner_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.ut_partner_leads(id) ON DELETE SET NULL,
  business_name TEXT NOT NULL,
  category TEXT NOT NULL,
  services_offered TEXT[] DEFAULT '{}',
  pricing_range TEXT,
  availability JSONB DEFAULT '{}'::jsonb,
  city TEXT,
  state TEXT,
  rating NUMERIC(3,2) DEFAULT 0,
  onboarding_status TEXT NOT NULL DEFAULT 'pending',
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  social_links JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.ut_partner_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_outreach_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_partner_profiles ENABLE ROW LEVEL SECURITY;

-- Authenticated users can CRUD all UT tables (admin/employee/manager access)
CREATE POLICY "Authenticated users can manage ut_partner_leads"
  ON public.ut_partner_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage ut_outreach_logs"
  ON public.ut_outreach_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage ut_partner_profiles"
  ON public.ut_partner_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_ut_partner_leads_status ON public.ut_partner_leads(status);
CREATE INDEX idx_ut_partner_leads_category ON public.ut_partner_leads(category);
CREATE INDEX idx_ut_partner_leads_city ON public.ut_partner_leads(city);
CREATE INDEX idx_ut_partner_leads_ai_score ON public.ut_partner_leads(ai_score DESC);
CREATE INDEX idx_ut_outreach_logs_lead_id ON public.ut_outreach_logs(lead_id);
CREATE INDEX idx_ut_partner_profiles_category ON public.ut_partner_profiles(category);
