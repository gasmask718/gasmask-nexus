
-- Competitor Intelligence
CREATE TABLE public.brandaro_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  website TEXT,
  pricing JSONB DEFAULT '{}',
  offers JSONB DEFAULT '[]',
  guarantees TEXT[],
  positioning TEXT,
  weaknesses TEXT[],
  reviews_summary TEXT,
  source TEXT DEFAULT 'manual',
  territory_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Weakness Extraction
CREATE TABLE public.brandaro_competitor_weaknesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID REFERENCES public.brandaro_competitors(id) ON DELETE CASCADE NOT NULL,
  weakness_type TEXT NOT NULL,
  description TEXT NOT NULL,
  exploitability_score NUMERIC DEFAULT 0,
  exploit_strategy TEXT,
  source TEXT DEFAULT 'ai_analysis',
  validated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Demand Capture / Leads from competitors
CREATE TABLE public.brandaro_competitor_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID REFERENCES public.brandaro_competitors(id),
  lead_id TEXT,
  capture_method TEXT,
  competitor_mentioned BOOLEAN DEFAULT false,
  original_objection TEXT,
  reposition_strategy TEXT,
  outcome TEXT DEFAULT 'pending',
  revenue_captured NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Market Share Tracking
CREATE TABLE public.brandaro_market_share (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id UUID,
  competitor_id UUID REFERENCES public.brandaro_competitors(id),
  period TEXT NOT NULL,
  brandaro_leads INTEGER DEFAULT 0,
  competitor_leads_estimated INTEGER DEFAULT 0,
  win_rate NUMERIC DEFAULT 0,
  revenue_captured NUMERIC DEFAULT 0,
  market_share_pct NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Offer Undercut Engine
CREATE TABLE public.brandaro_undercut_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID REFERENCES public.brandaro_competitors(id),
  competitor_offer TEXT,
  brandaro_counter_offer TEXT NOT NULL,
  strategy TEXT,
  discount_pct NUMERIC,
  urgency_trigger TEXT,
  conversion_rate NUMERIC DEFAULT 0,
  times_used INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_competitor_weaknesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_competitor_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_market_share ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_undercut_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.brandaro_competitors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON public.brandaro_competitor_weaknesses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON public.brandaro_competitor_captures FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON public.brandaro_market_share FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON public.brandaro_undercut_offers FOR ALL TO authenticated USING (true) WITH CHECK (true);
