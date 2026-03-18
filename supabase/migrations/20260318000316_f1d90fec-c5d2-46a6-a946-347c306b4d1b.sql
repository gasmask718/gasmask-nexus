
-- Personality performance tracking
CREATE TABLE public.brandaro_personality_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personality_id UUID NOT NULL REFERENCES public.brandaro_personalities(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_calls INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue_generated NUMERIC(12,2) DEFAULT 0,
  objection_wins INTEGER DEFAULT 0,
  objection_total INTEGER DEFAULT 0,
  avg_time_to_close_mins NUMERIC(8,2) DEFAULT 0,
  engagement_score NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(personality_id, date)
);

-- Evolution history log
CREATE TABLE public.brandaro_personality_evolution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personality_id UUID REFERENCES public.brandaro_personalities(id) ON DELETE SET NULL,
  parent_personality_id UUID REFERENCES public.brandaro_personalities(id) ON DELETE SET NULL,
  evolution_type TEXT NOT NULL, -- 'enhancement', 'mutation', 'crossover', 'auto_generated'
  generation INTEGER DEFAULT 1,
  traits_inherited JSONB DEFAULT '{}',
  traits_modified JSONB DEFAULT '{}',
  reason TEXT,
  performance_before JSONB DEFAULT '{}',
  performance_after JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- A/B test campaigns
CREATE TABLE public.brandaro_personality_ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  personality_a_id UUID NOT NULL REFERENCES public.brandaro_personalities(id) ON DELETE CASCADE,
  personality_b_id UUID NOT NULL REFERENCES public.brandaro_personalities(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'running', -- 'running', 'completed', 'cancelled'
  winner_id UUID REFERENCES public.brandaro_personalities(id) ON DELETE SET NULL,
  leads_routed_a INTEGER DEFAULT 0,
  leads_routed_b INTEGER DEFAULT 0,
  conversions_a INTEGER DEFAULT 0,
  conversions_b INTEGER DEFAULT 0,
  revenue_a NUMERIC(12,2) DEFAULT 0,
  revenue_b NUMERIC(12,2) DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Personality lifecycle/ranking
CREATE TABLE public.brandaro_personality_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personality_id UUID NOT NULL REFERENCES public.brandaro_personalities(id) ON DELETE CASCADE UNIQUE,
  rank_position INTEGER DEFAULT 0,
  tier TEXT DEFAULT 'testing', -- 'testing', 'scaling', 'optimizing', 'retired'
  conversion_rate NUMERIC(5,2) DEFAULT 0,
  revenue_per_lead NUMERIC(10,2) DEFAULT 0,
  objection_win_rate NUMERIC(5,2) DEFAULT 0,
  speed_score NUMERIC(5,2) DEFAULT 0,
  composite_score NUMERIC(6,2) DEFAULT 0,
  last_evaluated_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_personality_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_personality_evolution ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_personality_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_personality_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.brandaro_personality_performance FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON public.brandaro_personality_evolution FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON public.brandaro_personality_ab_tests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON public.brandaro_personality_rankings FOR ALL TO authenticated USING (true) WITH CHECK (true);
