
-- Solar Leads
CREATE TABLE public.solar_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  homeowner_status BOOLEAN DEFAULT NULL,
  credit_range TEXT,
  monthly_bill_range TEXT,
  roof_type TEXT,
  roof_age_years INTEGER,
  interest_level INTEGER DEFAULT 0,
  lead_score INTEGER DEFAULT 0,
  lead_source TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'new',
  assigned_agent_id UUID,
  assigned_partner_id UUID,
  skip_traced BOOLEAN DEFAULT false,
  call_count INTEGER DEFAULT 0,
  last_called_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.solar_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage solar_leads" ON public.solar_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Solar Interactions
CREATE TABLE public.solar_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.solar_leads(id) ON DELETE CASCADE NOT NULL,
  interaction_type TEXT NOT NULL,
  transcript TEXT,
  summary TEXT,
  sentiment_score NUMERIC,
  objections_detected JSONB DEFAULT '[]',
  next_action TEXT,
  agent_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.solar_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage solar_interactions" ON public.solar_interactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Solar Partners (installer network)
CREATE TABLE public.solar_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  states_served TEXT[] DEFAULT '{}',
  commission_percentage NUMERIC DEFAULT 10,
  avg_close_rate NUMERIC DEFAULT 0,
  avg_deal_size NUMERIC DEFAULT 0,
  response_time_hours NUMERIC DEFAULT 24,
  webhook_endpoint TEXT,
  ranking_score NUMERIC DEFAULT 50,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.solar_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage solar_partners" ON public.solar_partners FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Solar Deals
CREATE TABLE public.solar_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.solar_leads(id) ON DELETE SET NULL,
  partner_id UUID REFERENCES public.solar_partners(id) ON DELETE SET NULL,
  deal_value NUMERIC DEFAULT 0,
  commission_percentage NUMERIC DEFAULT 10,
  commission_amount NUMERIC DEFAULT 0,
  stage TEXT DEFAULT 'sent',
  payout_status TEXT DEFAULT 'pending',
  closed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.solar_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage solar_deals" ON public.solar_deals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Solar Agents
CREATE TABLE public.solar_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'VA',
  performance_score NUMERIC DEFAULT 0,
  close_rate NUMERIC DEFAULT 0,
  total_revenue_generated NUMERIC DEFAULT 0,
  total_calls INTEGER DEFAULT 0,
  total_appointments INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.solar_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage solar_agents" ON public.solar_agents FOR ALL TO authenticated USING (true) WITH CHECK (true);
