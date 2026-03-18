
-- Brandaro Global Scaling System tables

-- Territory registry
CREATE TABLE public.brandaro_territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT,
  region TEXT,
  status TEXT NOT NULL DEFAULT 'testing' CHECK (status IN ('testing','active','scaling','paused','retired')),
  assigned_team JSONB DEFAULT '[]',
  localization_profile JSONB DEFAULT '{}',
  cloned_from UUID REFERENCES public.brandaro_territories(id),
  launched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Regional performance tracking
CREATE TABLE public.brandaro_territory_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id UUID REFERENCES public.brandaro_territories(id) ON DELETE CASCADE NOT NULL,
  period TEXT NOT NULL,
  revenue NUMERIC DEFAULT 0,
  leads_generated INTEGER DEFAULT 0,
  conversion_rate NUMERIC DEFAULT 0,
  cost_per_lead NUMERIC DEFAULT 0,
  roi NUMERIC DEFAULT 0,
  best_personality TEXT,
  best_offer TEXT,
  computed_at TIMESTAMPTZ DEFAULT now()
);

-- Market duplication log
CREATE TABLE public.brandaro_market_duplications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_territory_id UUID REFERENCES public.brandaro_territories(id),
  target_territory_id UUID REFERENCES public.brandaro_territories(id),
  components_cloned JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending',
  initiated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Expansion suggestions
CREATE TABLE public.brandaro_expansion_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggested_city TEXT NOT NULL,
  suggested_state TEXT,
  reason TEXT,
  similarity_score NUMERIC DEFAULT 0,
  similar_to_territory_id UUID REFERENCES public.brandaro_territories(id),
  market_size_estimate TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','deployed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Global scaling actions log
CREATE TABLE public.brandaro_scaling_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id UUID REFERENCES public.brandaro_territories(id),
  action_type TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  result TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_territory_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_market_duplications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_expansion_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_scaling_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage territories" ON public.brandaro_territories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage territory_performance" ON public.brandaro_territory_performance FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage market_duplications" ON public.brandaro_market_duplications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage expansion_suggestions" ON public.brandaro_expansion_suggestions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage scaling_log" ON public.brandaro_scaling_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
