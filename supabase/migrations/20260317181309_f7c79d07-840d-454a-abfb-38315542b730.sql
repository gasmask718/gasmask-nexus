
-- Offer ladder system
CREATE TABLE public.brandaro_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tier TEXT NOT NULL UNIQUE,
  price NUMERIC NOT NULL DEFAULT 750,
  features JSONB DEFAULT '[]'::jsonb,
  upsell_from TEXT,
  upsell_to TEXT,
  conversion_priority INTEGER DEFAULT 1,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed offer tiers
INSERT INTO public.brandaro_offers (name, tier, price, features, upsell_to, conversion_priority) VALUES
('Starter', 'starter', 750, '["1-3 page website","Mobile optimized","Basic contact form","Fast delivery"]', 'growth', 1),
('Growth', 'growth', 1500, '["5-8 pages","SEO setup","Booking integration","Enhanced design system","Everything in Starter"]', 'premium', 2),
('Premium', 'premium', 3000, '["Full custom design","Conversion optimization","Advanced animations","CRM integration","Lead automation","Priority delivery"]', 'elite', 3),
('Elite', 'elite', 5000, '["Full brand build","Sales funnels","Ads integration","Automation systems","Consulting","Everything in Premium"]', null, 4);

-- Upsell engine
CREATE TABLE public.brandaro_upsell_engine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID,
  current_offer TEXT DEFAULT 'starter',
  recommended_offer TEXT,
  upsell_reason TEXT,
  probability_score INTEGER DEFAULT 50,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  acted_at TIMESTAMPTZ
);

-- Payment plans (deposit splits)
CREATE TABLE public.brandaro_payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID,
  offer_tier TEXT NOT NULL DEFAULT 'starter',
  total_amount NUMERIC NOT NULL,
  deposit_amount NUMERIC NOT NULL,
  remaining_amount NUMERIC NOT NULL DEFAULT 0,
  deposit_paid BOOLEAN DEFAULT false,
  fully_paid BOOLEAN DEFAULT false,
  stripe_session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Revenue metrics (aggregated)
CREATE TABLE public.brandaro_revenue_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT NOT NULL,
  total_leads INTEGER DEFAULT 0,
  total_closed INTEGER DEFAULT 0,
  avg_deal_size NUMERIC DEFAULT 0,
  upsell_rate NUMERIC DEFAULT 0,
  monthly_revenue NUMERIC DEFAULT 0,
  revenue_per_lead NUMERIC DEFAULT 0,
  top_industry TEXT,
  top_offer_tier TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_upsell_engine ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_revenue_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.brandaro_offers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON public.brandaro_upsell_engine FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON public.brandaro_payment_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON public.brandaro_revenue_metrics FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Public read on offers for client dashboard
CREATE POLICY "Public read offers" ON public.brandaro_offers FOR SELECT TO anon USING (active = true);
