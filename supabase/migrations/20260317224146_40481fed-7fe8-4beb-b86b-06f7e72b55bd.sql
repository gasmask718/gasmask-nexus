
-- Personality Engine Tables

CREATE TABLE public.brandaro_personalities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  tone text NOT NULL DEFAULT 'confident',
  cadence text NOT NULL DEFAULT 'medium',
  persuasion_style text NOT NULL DEFAULT 'logical',
  objection_style text NOT NULL DEFAULT 'reframe',
  closing_style text NOT NULL DEFAULT 'direct',
  energy_level integer NOT NULL DEFAULT 7 CHECK (energy_level >= 1 AND energy_level <= 10),
  voice_provider text,
  voice_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.brandaro_strategy_frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  structure jsonb NOT NULL DEFAULT '{}',
  best_use_case text,
  success_rate numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.brandaro_personality_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personality_id uuid REFERENCES public.brandaro_personalities(id) ON DELETE CASCADE NOT NULL,
  scenario text NOT NULL,
  script text NOT NULL,
  performance_score numeric DEFAULT 0,
  usage_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.brandaro_personality_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid,
  personality_id uuid REFERENCES public.brandaro_personalities(id) ON DELETE CASCADE NOT NULL,
  assigned_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.brandaro_personalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_strategy_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_personality_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_personality_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage personalities" ON public.brandaro_personalities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage frameworks" ON public.brandaro_strategy_frameworks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage personality scripts" ON public.brandaro_personality_scripts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage personality assignments" ON public.brandaro_personality_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_personality_scripts_pid ON public.brandaro_personality_scripts(personality_id);
CREATE INDEX idx_personality_assignments_lid ON public.brandaro_personality_assignments(lead_id);
CREATE INDEX idx_personality_assignments_pid ON public.brandaro_personality_assignments(personality_id);
