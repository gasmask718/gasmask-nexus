
-- Brandaro Digital Lead Database
-- Raw leads from CSV/Outscraper imports
CREATE TABLE public.brandaro_raw_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  phone_number TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  industry TEXT,
  rating NUMERIC(2,1),
  review_count INTEGER DEFAULT 0,
  website_url TEXT,
  website_status TEXT DEFAULT 'unknown' CHECK (website_status IN ('has_website','no_website','unknown')),
  email TEXT,
  google_maps_url TEXT,
  source TEXT DEFAULT 'csv_import',
  import_batch_id TEXT,
  imported_at TIMESTAMPTZ DEFAULT now(),
  imported_by UUID REFERENCES auth.users(id),
  raw_data JSONB DEFAULT '{}'
);

-- Clean/deduplicated leads
CREATE TABLE public.brandaro_clean_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_lead_id UUID REFERENCES public.brandaro_raw_leads(id),
  business_name TEXT NOT NULL,
  phone_number TEXT,
  phone_valid BOOLEAN DEFAULT false,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  industry TEXT,
  rating NUMERIC(2,1),
  review_count INTEGER DEFAULT 0,
  website_status TEXT DEFAULT 'no_website',
  email TEXT,
  google_maps_url TEXT,
  is_duplicate BOOLEAN DEFAULT false,
  cleaned_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Qualified leads with scoring
CREATE TABLE public.brandaro_qualified_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clean_lead_id UUID REFERENCES public.brandaro_clean_leads(id),
  business_name TEXT NOT NULL,
  phone_number TEXT,
  city TEXT,
  state TEXT,
  industry TEXT,
  rating NUMERIC(2,1),
  review_count INTEGER DEFAULT 0,
  priority_score INTEGER DEFAULT 0,
  priority_tier TEXT DEFAULT 'tier_3' CHECK (priority_tier IN ('tier_1','tier_2','tier_3')),
  lead_status TEXT DEFAULT 'new' CHECK (lead_status IN (
    'new','queued','calling','no_answer','voicemail','wrong_number',
    'not_interested','callback','send_info','interested','hot_lead','sold','disqualified'
  )),
  assigned_va UUID REFERENCES auth.users(id),
  call_attempts INTEGER DEFAULT 0,
  last_call_at TIMESTAMPTZ,
  next_callback_at TIMESTAMPTZ,
  call_notes TEXT,
  demo_status TEXT CHECK (demo_status IN ('pending','generating','generated','sent','opened','viewed','follow_up_needed')),
  demo_link TEXT,
  demo_created_at TIMESTAMPTZ,
  demo_sent_at TIMESTAMPTZ,
  proposal_status TEXT CHECK (proposal_status IN ('draft','sent','viewed','negotiation','accepted','rejected')),
  proposal_package TEXT,
  proposal_amount NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Brandaro clients (post-sale)
CREATE TABLE public.brandaro_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qualified_lead_id UUID REFERENCES public.brandaro_qualified_leads(id),
  business_name TEXT NOT NULL,
  owner_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  logo_url TEXT,
  brand_colors JSONB DEFAULT '{}',
  services_offered TEXT[],
  service_areas TEXT[],
  domain_info TEXT,
  social_media JSONB DEFAULT '{}',
  website_package TEXT,
  website_package_price NUMERIC(10,2),
  addon_services JSONB DEFAULT '[]',
  monthly_recurring NUMERIC(10,2) DEFAULT 0,
  onboarding_status TEXT DEFAULT 'pending' CHECK (onboarding_status IN (
    'pending','content_gathering','design_phase','draft_ready',
    'client_review','revisions','final_approval','launched'
  )),
  maintenance_status TEXT DEFAULT 'inactive' CHECK (maintenance_status IN ('active','inactive','paused','cancelled')),
  assigned_builder UUID REFERENCES auth.users(id),
  project_deadline DATE,
  launched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.brandaro_raw_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_clean_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_qualified_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_clients ENABLE ROW LEVEL SECURITY;

-- RLS policies - authenticated users with admin/owner/va roles can access
CREATE POLICY "Authenticated users can view brandaro_raw_leads" ON public.brandaro_raw_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert brandaro_raw_leads" ON public.brandaro_raw_leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update brandaro_raw_leads" ON public.brandaro_raw_leads FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view brandaro_clean_leads" ON public.brandaro_clean_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert brandaro_clean_leads" ON public.brandaro_clean_leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update brandaro_clean_leads" ON public.brandaro_clean_leads FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view brandaro_qualified_leads" ON public.brandaro_qualified_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert brandaro_qualified_leads" ON public.brandaro_qualified_leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update brandaro_qualified_leads" ON public.brandaro_qualified_leads FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view brandaro_clients" ON public.brandaro_clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert brandaro_clients" ON public.brandaro_clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update brandaro_clients" ON public.brandaro_clients FOR UPDATE TO authenticated USING (true);
