
-- Dynasty Monetization Engine: Talent + Brand Deal Exchange

CREATE TABLE public.dme_talent_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  niche TEXT,
  audience_size INTEGER DEFAULT 0,
  engagement_rate NUMERIC DEFAULT 0,
  pricing NUMERIC DEFAULT 0,
  portfolio_url TEXT,
  bio TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.dme_brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  contact_email TEXT,
  contact_name TEXT,
  budget NUMERIC DEFAULT 0,
  subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'basic', 'premium', 'enterprise')),
  logo_url TEXT,
  industry TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.dme_brand_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.dme_brands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  budget NUMERIC NOT NULL DEFAULT 0,
  payout_type TEXT NOT NULL DEFAULT 'flat' CHECK (payout_type IN ('flat', 'percentage', 'milestone')),
  duration_days INTEGER DEFAULT 30,
  min_audience INTEGER DEFAULT 0,
  niche_tags TEXT[] DEFAULT '{}',
  platform_fee_pct NUMERIC DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.dme_campaign_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.dme_brand_campaigns(id) ON DELETE CASCADE,
  talent_id UUID NOT NULL REFERENCES public.dme_talent_profiles(id) ON DELETE CASCADE,
  pitch TEXT,
  proposed_rate NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'shortlisted', 'accepted', 'rejected', 'withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.dme_campaign_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.dme_brand_campaigns(id) ON DELETE CASCADE,
  talent_id UUID NOT NULL REFERENCES public.dme_talent_profiles(id) ON DELETE CASCADE,
  agreed_rate NUMERIC NOT NULL DEFAULT 0,
  platform_fee NUMERIC DEFAULT 0,
  net_payout NUMERIC DEFAULT 0,
  contract_start DATE,
  contract_end DATE,
  deliverables TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'terminated', 'disputed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.dme_platform_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.dme_disputes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.dme_campaign_assignments(id) ON DELETE CASCADE,
  filed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed')),
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_dme_talent_niche ON public.dme_talent_profiles(niche);
CREATE INDEX idx_dme_talent_status ON public.dme_talent_profiles(status);
CREATE INDEX idx_dme_brands_status ON public.dme_brands(status);
CREATE INDEX idx_dme_campaigns_brand ON public.dme_brand_campaigns(brand_id);
CREATE INDEX idx_dme_campaigns_status ON public.dme_brand_campaigns(status);
CREATE INDEX idx_dme_applications_campaign ON public.dme_campaign_applications(campaign_id);
CREATE INDEX idx_dme_applications_talent ON public.dme_campaign_applications(talent_id);
CREATE INDEX idx_dme_assignments_campaign ON public.dme_campaign_assignments(campaign_id);
CREATE INDEX idx_dme_assignments_talent ON public.dme_campaign_assignments(talent_id);
CREATE INDEX idx_dme_disputes_assignment ON public.dme_disputes(assignment_id);

-- RLS
ALTER TABLE public.dme_talent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dme_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dme_brand_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dme_campaign_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dme_campaign_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dme_platform_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dme_disputes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Auth read talent" ON public.dme_talent_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth manage own talent" ON public.dme_talent_profiles FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Service full talent" ON public.dme_talent_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Auth read brands" ON public.dme_brands FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth manage own brand" ON public.dme_brands FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Service full brands" ON public.dme_brands FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Auth read campaigns" ON public.dme_brand_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth manage own campaigns" ON public.dme_brand_campaigns FOR ALL TO authenticated USING (brand_id IN (SELECT id FROM public.dme_brands WHERE user_id = auth.uid())) WITH CHECK (brand_id IN (SELECT id FROM public.dme_brands WHERE user_id = auth.uid()));
CREATE POLICY "Service full campaigns" ON public.dme_brand_campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Auth read applications" ON public.dme_campaign_applications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth manage own apps" ON public.dme_campaign_applications FOR ALL TO authenticated USING (talent_id IN (SELECT id FROM public.dme_talent_profiles WHERE user_id = auth.uid())) WITH CHECK (talent_id IN (SELECT id FROM public.dme_talent_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Service full apps" ON public.dme_campaign_applications FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Auth read assignments" ON public.dme_campaign_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service full assignments" ON public.dme_campaign_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Auth read config" ON public.dme_platform_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service full config" ON public.dme_platform_config FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Auth read disputes" ON public.dme_disputes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth file dispute" ON public.dme_disputes FOR INSERT TO authenticated WITH CHECK (filed_by = auth.uid());
CREATE POLICY "Service full disputes" ON public.dme_disputes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Default platform config
INSERT INTO public.dme_platform_config (config_key, config_value) VALUES
  ('default_platform_fee_pct', '10'),
  ('min_contract_days', '7'),
  ('max_platform_fee_pct', '25');

-- Updated_at triggers
CREATE TRIGGER trg_dme_talent_updated BEFORE UPDATE ON public.dme_talent_profiles FOR EACH ROW EXECUTE FUNCTION public.update_dynasty_earn_updated_at();
CREATE TRIGGER trg_dme_brands_updated BEFORE UPDATE ON public.dme_brands FOR EACH ROW EXECUTE FUNCTION public.update_dynasty_earn_updated_at();
CREATE TRIGGER trg_dme_campaigns_updated BEFORE UPDATE ON public.dme_brand_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_dynasty_earn_updated_at();
CREATE TRIGGER trg_dme_apps_updated BEFORE UPDATE ON public.dme_campaign_applications FOR EACH ROW EXECUTE FUNCTION public.update_dynasty_earn_updated_at();
CREATE TRIGGER trg_dme_assignments_updated BEFORE UPDATE ON public.dme_campaign_assignments FOR EACH ROW EXECUTE FUNCTION public.update_dynasty_earn_updated_at();
