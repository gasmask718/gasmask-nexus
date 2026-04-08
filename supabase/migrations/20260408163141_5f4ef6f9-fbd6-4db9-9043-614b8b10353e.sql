
-- Dynasty Brand Acquisition & Pricing System

CREATE TABLE public.dynasty_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_email TEXT,
  contact_name TEXT,
  industry TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free','starter','growth','enterprise')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended','churned')),
  monthly_spend NUMERIC DEFAULT 0,
  logo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.dynasty_brand_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name TEXT NOT NULL,
  contact_email TEXT,
  contact_name TEXT,
  budget NUMERIC DEFAULT 0,
  goals TEXT,
  industry TEXT,
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied','reviewing','approved','rejected')),
  reviewer_notes TEXT,
  reviewed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.dynasty_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.dynasty_brands(id) ON DELETE CASCADE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter','growth','enterprise')),
  monthly_fee NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.dynasty_brand_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.dynasty_brands(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  budget NUMERIC DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'awareness' CHECK (type IN ('awareness','conversion','content','ambassador')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed','cancelled')),
  platform_fee_pct NUMERIC DEFAULT 15,
  start_date DATE,
  end_date DATE,
  min_creator_tier TEXT DEFAULT 'starter',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.dynasty_creator_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT,
  email TEXT,
  tier TEXT NOT NULL DEFAULT 'starter' CHECK (tier IN ('starter','pro','elite')),
  performance_score NUMERIC DEFAULT 0,
  total_earnings NUMERIC DEFAULT 0,
  campaigns_completed INTEGER DEFAULT 0,
  specialties TEXT[],
  is_flagged_elite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.dynasty_brand_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type TEXT NOT NULL DEFAULT 'brand',
  recipient_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_dynasty_brands_status ON public.dynasty_brands(status);
CREATE INDEX idx_dynasty_brands_tier ON public.dynasty_brands(subscription_tier);
CREATE INDEX idx_dynasty_brand_apps_status ON public.dynasty_brand_applications(status);
CREATE INDEX idx_dynasty_campaigns_brand ON public.dynasty_brand_campaigns(brand_id);
CREATE INDEX idx_dynasty_campaigns_status ON public.dynasty_brand_campaigns(status);
CREATE INDEX idx_dynasty_creator_tiers_tier ON public.dynasty_creator_tiers(tier);
CREATE INDEX idx_dynasty_creator_tiers_user ON public.dynasty_creator_tiers(user_id);
CREATE INDEX idx_dynasty_notif_recipient ON public.dynasty_brand_notifications(recipient_id);

-- RLS
ALTER TABLE public.dynasty_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynasty_brand_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynasty_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynasty_brand_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynasty_creator_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynasty_brand_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view brands" ON public.dynasty_brands FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage brands" ON public.dynasty_brands FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can view applications" ON public.dynasty_brand_applications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage applications" ON public.dynasty_brand_applications FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can view subscriptions" ON public.dynasty_subscriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage subscriptions" ON public.dynasty_subscriptions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can view campaigns" ON public.dynasty_brand_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage campaigns" ON public.dynasty_brand_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can view creator tiers" ON public.dynasty_creator_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage creator tiers" ON public.dynasty_creator_tiers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can view notifications" ON public.dynasty_brand_notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage notifications" ON public.dynasty_brand_notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Updated_at triggers
CREATE TRIGGER update_dynasty_brands_updated_at BEFORE UPDATE ON public.dynasty_brands FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_dynasty_brand_apps_updated_at BEFORE UPDATE ON public.dynasty_brand_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_dynasty_campaigns_updated_at BEFORE UPDATE ON public.dynasty_brand_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_dynasty_creator_tiers_updated_at BEFORE UPDATE ON public.dynasty_creator_tiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
