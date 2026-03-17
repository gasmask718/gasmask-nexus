
-- Internal ads for Brandaro's own lead generation
CREATE TABLE public.brandaro_internal_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL DEFAULT 'google',
  campaign_name TEXT NOT NULL,
  budget_daily NUMERIC NOT NULL DEFAULT 0,
  total_spent NUMERIC NOT NULL DEFAULT 0,
  leads_generated INTEGER NOT NULL DEFAULT 0,
  cost_per_lead NUMERIC GENERATED ALWAYS AS (CASE WHEN leads_generated > 0 THEN total_spent / leads_generated ELSE 0 END) STORED,
  conversions INTEGER NOT NULL DEFAULT 0,
  revenue_generated NUMERIC NOT NULL DEFAULT 0,
  roi_pct NUMERIC GENERATED ALWAYS AS (CASE WHEN total_spent > 0 THEN ((revenue_generated - total_spent) / total_spent) * 100 ELSE 0 END) STORED,
  status TEXT NOT NULL DEFAULT 'draft',
  target_keywords TEXT[] DEFAULT '{}',
  target_audience TEXT,
  funnel_stage TEXT DEFAULT 'awareness',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client ads service (revenue driver)
CREATE TABLE public.brandaro_client_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID,
  client_name TEXT,
  platform TEXT NOT NULL DEFAULT 'google',
  campaign_name TEXT NOT NULL,
  monthly_budget NUMERIC NOT NULL DEFAULT 0,
  total_spent NUMERIC NOT NULL DEFAULT 0,
  leads_generated INTEGER NOT NULL DEFAULT 0,
  cost_per_lead NUMERIC GENERATED ALWAYS AS (CASE WHEN leads_generated > 0 THEN total_spent / leads_generated ELSE 0 END) STORED,
  conversions INTEGER NOT NULL DEFAULT 0,
  revenue_attributed NUMERIC NOT NULL DEFAULT 0,
  roi_pct NUMERIC GENERATED ALWAYS AS (CASE WHEN total_spent > 0 THEN ((revenue_attributed - total_spent) / total_spent) * 100 ELSE 0 END) STORED,
  service_fee NUMERIC NOT NULL DEFAULT 500,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ad lead inbound tracking
CREATE TABLE public.brandaro_ad_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_campaign_id UUID,
  source_type TEXT NOT NULL DEFAULT 'internal',
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  industry TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  landing_page TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  auto_called BOOLEAN DEFAULT false,
  demo_generated BOOLEAN DEFAULT false,
  converted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.brandaro_internal_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_client_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_ad_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage internal ads" ON public.brandaro_internal_ads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage client ads" ON public.brandaro_client_ads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage ad leads" ON public.brandaro_ad_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
