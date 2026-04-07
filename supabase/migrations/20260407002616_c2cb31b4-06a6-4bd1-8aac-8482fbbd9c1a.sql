
-- Kids & Family Vendors
CREATE TABLE public.kf_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  subcategory TEXT,
  city TEXT,
  state TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  description TEXT,
  profile_image_url TEXT,
  portfolio_urls TEXT[],
  pricing_type TEXT DEFAULT 'flat',
  base_rate NUMERIC(10,2),
  status TEXT DEFAULT 'pending',
  trust_score NUMERIC(5,2) DEFAULT 0,
  total_bookings INTEGER DEFAULT 0,
  total_revenue NUMERIC(12,2) DEFAULT 0,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.kf_vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage kf_vendors" ON public.kf_vendors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access kf_vendors" ON public.kf_vendors FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_kf_vendors_updated_at BEFORE UPDATE ON public.kf_vendors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Kids & Family Bundles
CREATE TABLE public.kf_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  city TEXT,
  base_cost NUMERIC(10,2) DEFAULT 0,
  markup_pct NUMERIC(5,2) DEFAULT 20,
  final_price NUMERIC(10,2) GENERATED ALWAYS AS (base_cost * (1 + markup_pct / 100)) STORED,
  status TEXT DEFAULT 'draft',
  is_ai_generated BOOLEAN DEFAULT false,
  performance_score NUMERIC(5,2) DEFAULT 0,
  total_sold INTEGER DEFAULT 0,
  image_url TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.kf_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage kf_bundles" ON public.kf_bundles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access kf_bundles" ON public.kf_bundles FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_kf_bundles_updated_at BEFORE UPDATE ON public.kf_bundles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bundle Components (junction)
CREATE TABLE public.kf_bundle_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID REFERENCES public.kf_bundles(id) ON DELETE CASCADE NOT NULL,
  component_type TEXT NOT NULL DEFAULT 'experience',
  experience_id UUID REFERENCES public.experiences_master(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES public.kf_vendors(id) ON DELETE SET NULL,
  component_name TEXT NOT NULL,
  component_cost NUMERIC(10,2) DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.kf_bundle_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage kf_bundle_components" ON public.kf_bundle_components FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Family Profiles
CREATE TABLE public.kf_family_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  phone TEXT,
  parent_name TEXT,
  kids_ages INTEGER[],
  city TEXT,
  state TEXT,
  total_bookings INTEGER DEFAULT 0,
  total_spend NUMERIC(12,2) DEFAULT 0,
  preferences JSONB DEFAULT '{}',
  last_booking_at TIMESTAMPTZ,
  vip_status BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.kf_family_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage kf_family_profiles" ON public.kf_family_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_kf_family_profiles_updated_at BEFORE UPDATE ON public.kf_family_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- API Connections
CREATE TABLE public.kf_api_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL,
  api_endpoint TEXT,
  status TEXT DEFAULT 'disconnected',
  last_sync_at TIMESTAMPTZ,
  sync_frequency TEXT DEFAULT 'every_6_hours',
  total_synced INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.kf_api_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage kf_api_connections" ON public.kf_api_connections FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_kf_api_connections_updated_at BEFORE UPDATE ON public.kf_api_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vendor Leads (nationwide expansion)
CREATE TABLE public.kf_vendor_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  city TEXT,
  state TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  source TEXT DEFAULT 'google_places',
  place_id TEXT,
  rating NUMERIC(3,2),
  review_count INTEGER,
  status TEXT DEFAULT 'new',
  outreach_status TEXT DEFAULT 'not_contacted',
  outreach_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.kf_vendor_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage kf_vendor_leads" ON public.kf_vendor_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_kf_vendor_leads_place_id ON public.kf_vendor_leads(place_id);
CREATE INDEX idx_kf_vendors_category ON public.kf_vendors(category);
CREATE INDEX idx_kf_vendors_city ON public.kf_vendors(city);
CREATE INDEX idx_kf_bundles_status ON public.kf_bundles(status);
