
-- brandaro_competitor_intel
CREATE TABLE public.brandaro_competitor_intel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_name text NOT NULL,
  pricing_model text,
  offer_structure text,
  guarantees text,
  positioning text,
  strengths jsonb DEFAULT '[]'::jsonb,
  weaknesses jsonb DEFAULT '[]'::jsonb,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_bci_name ON public.brandaro_competitor_intel(competitor_name);
ALTER TABLE public.brandaro_competitor_intel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read competitor intel" ON public.brandaro_competitor_intel FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert competitor intel" ON public.brandaro_competitor_intel FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update competitor intel" ON public.brandaro_competitor_intel FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service can manage competitor intel" ON public.brandaro_competitor_intel FOR ALL TO service_role USING (true) WITH CHECK (true);

-- brandaro_offer_variants
CREATE TABLE public.brandaro_offer_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_name text NOT NULL,
  pricing numeric DEFAULT 0,
  headline text,
  value_props jsonb DEFAULT '[]'::jsonb,
  guarantee text,
  urgency_trigger text,
  target_segment text,
  conversion_rate numeric DEFAULT 0,
  revenue_generated numeric DEFAULT 0,
  status text DEFAULT 'testing',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_bov_status ON public.brandaro_offer_variants(status);
CREATE INDEX idx_bov_segment ON public.brandaro_offer_variants(target_segment);
ALTER TABLE public.brandaro_offer_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read offers" ON public.brandaro_offer_variants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert offers" ON public.brandaro_offer_variants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update offers" ON public.brandaro_offer_variants FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service can manage offers" ON public.brandaro_offer_variants FOR ALL TO service_role USING (true) WITH CHECK (true);

-- brandaro_pricing_tests
CREATE TABLE public.brandaro_pricing_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_price numeric NOT NULL,
  test_price numeric NOT NULL,
  segment text,
  conversion_rate numeric DEFAULT 0,
  revenue_per_lead numeric DEFAULT 0,
  test_status text DEFAULT 'running',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_bpt_status ON public.brandaro_pricing_tests(test_status);
ALTER TABLE public.brandaro_pricing_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read pricing tests" ON public.brandaro_pricing_tests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert pricing tests" ON public.brandaro_pricing_tests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update pricing tests" ON public.brandaro_pricing_tests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service can manage pricing tests" ON public.brandaro_pricing_tests FOR ALL TO service_role USING (true) WITH CHECK (true);

-- brandaro_positioning_tests
CREATE TABLE public.brandaro_positioning_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  positioning_angle text NOT NULL,
  headline text,
  script_variant text,
  conversion_rate numeric DEFAULT 0,
  engagement_rate numeric DEFAULT 0,
  win_rate numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_bpost_angle ON public.brandaro_positioning_tests(positioning_angle);
ALTER TABLE public.brandaro_positioning_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read positioning" ON public.brandaro_positioning_tests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert positioning" ON public.brandaro_positioning_tests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update positioning" ON public.brandaro_positioning_tests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service can manage positioning" ON public.brandaro_positioning_tests FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.brandaro_offer_variants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.brandaro_pricing_tests;
