
-- Prop stat context: persists computed stats for every prop
CREATE TABLE public.sbo_prop_stat_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prop_id UUID REFERENCES public.sbo_player_props(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  stat_type TEXT NOT NULL,
  line_value NUMERIC NOT NULL,
  season_avg NUMERIC,
  last_5_avg NUMERIC,
  last_10_avg NUMERIC,
  vs_opponent_avg NUMERIC,
  vs_opponent_games INT DEFAULT 0,
  opponent_team TEXT,
  opponent_def_rating NUMERIC,
  opponent_ppg_allowed NUMERIC,
  team_pace NUMERIC,
  minutes_avg NUMERIC,
  usage_rate NUMERIC,
  variance_score NUMERIC,
  injury_status TEXT,
  projection_value NUMERIC,
  edge_vs_line NUMERIC,
  confidence_score NUMERIC,
  data_quality TEXT DEFAULT 'partial',
  last_5_values JSONB,
  last_10_values JSONB,
  vs_opponent_values JSONB,
  game_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(prop_id)
);

ALTER TABLE public.sbo_prop_stat_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read prop stat context"
  ON public.sbo_prop_stat_context FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage prop stat context"
  ON public.sbo_prop_stat_context FOR ALL TO service_role USING (true);

CREATE INDEX idx_sbo_prop_stat_context_game_date ON public.sbo_prop_stat_context(game_date);
CREATE INDEX idx_sbo_prop_stat_context_player ON public.sbo_prop_stat_context(player_name);
