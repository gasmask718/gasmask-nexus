-- NBA Player Stats Cache (daily refresh)
CREATE TABLE public.nba_player_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  team TEXT NOT NULL,
  position TEXT,
  -- Recent performance stats
  last_5_games_avg_pts NUMERIC,
  last_5_games_avg_reb NUMERIC,
  last_5_games_avg_ast NUMERIC,
  last_5_games_avg_3pm NUMERIC,
  last_5_games_avg_pra NUMERIC,
  last_10_games_avg_pts NUMERIC,
  last_10_games_avg_reb NUMERIC,
  last_10_games_avg_ast NUMERIC,
  last_10_games_avg_3pm NUMERIC,
  last_10_games_avg_pra NUMERIC,
  -- Season averages
  season_avg_pts NUMERIC,
  season_avg_reb NUMERIC,
  season_avg_ast NUMERIC,
  season_avg_3pm NUMERIC,
  season_avg_pra NUMERIC,
  season_avg_min NUMERIC,
  -- Variance
  std_pts NUMERIC,
  std_reb NUMERIC,
  std_ast NUMERIC,
  std_3pm NUMERIC,
  std_pra NUMERIC,
  -- Minutes trend
  minutes_last_5_avg NUMERIC,
  usage_rate NUMERIC,
  -- Status
  injury_status TEXT DEFAULT 'active', -- 'out', 'questionable', 'active'
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(player_id)
);

-- NBA Team Stats
CREATE TABLE public.nba_team_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_abbr TEXT NOT NULL,
  team_name TEXT NOT NULL,
  -- Defensive rankings by position
  def_rank_vs_pg INTEGER,
  def_rank_vs_sg INTEGER,
  def_rank_vs_sf INTEGER,
  def_rank_vs_pf INTEGER,
  def_rank_vs_c INTEGER,
  def_rank_overall INTEGER,
  -- Pace
  pace_rating NUMERIC,
  pace_tier TEXT DEFAULT 'avg', -- 'slow', 'avg', 'fast'
  -- Points allowed
  pts_allowed_avg NUMERIC,
  -- Last updated
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_abbr)
);

-- Today's NBA Games
CREATE TABLE public.nba_games_today (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  game_time TIMESTAMPTZ,
  home_team_back_to_back BOOLEAN DEFAULT false,
  away_team_back_to_back BOOLEAN DEFAULT false,
  game_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'scheduled', -- 'scheduled', 'live', 'final'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, game_date)
);

-- NBA Props Generated (auto-generated from stats)
CREATE TABLE public.nba_props_generated (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  team TEXT NOT NULL,
  opponent TEXT NOT NULL,
  stat_type TEXT NOT NULL, -- 'PTS', 'REB', 'AST', '3PM', 'PRA'
  line_value NUMERIC NOT NULL,
  over_under TEXT NOT NULL DEFAULT 'over',
  -- Calculated values
  projected_value NUMERIC,
  estimated_probability NUMERIC,
  break_even_probability NUMERIC DEFAULT 0.50,
  edge NUMERIC,
  confidence_score INTEGER,
  simulated_roi NUMERIC,
  volatility_score TEXT DEFAULT 'medium',
  -- Calibration data
  calibration_factors JSONB,
  data_completeness INTEGER DEFAULT 0,
  -- Context
  home_game BOOLEAN DEFAULT false,
  opponent_def_tier TEXT,
  pace_tier TEXT,
  minutes_trend TEXT,
  back_to_back BOOLEAN DEFAULT false,
  -- Reasoning
  reasoning TEXT[],
  -- Recommendation
  recommendation TEXT DEFAULT 'pass', -- 'strong_play', 'lean', 'pass', 'avoid'
  source TEXT DEFAULT 'ai_model_nba',
  game_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NBA Stats Refresh Log
CREATE TABLE public.nba_stats_refresh_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  refresh_date DATE NOT NULL DEFAULT CURRENT_DATE,
  games_fetched INTEGER DEFAULT 0,
  players_updated INTEGER DEFAULT 0,
  teams_updated INTEGER DEFAULT 0,
  props_generated INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending', 'running', 'complete', 'failed'
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nba_player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nba_team_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nba_games_today ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nba_props_generated ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nba_stats_refresh_log ENABLE ROW LEVEL SECURITY;

-- Public read policies (stats are public data)
CREATE POLICY "Anyone can read NBA player stats" ON public.nba_player_stats FOR SELECT USING (true);
CREATE POLICY "Anyone can read NBA team stats" ON public.nba_team_stats FOR SELECT USING (true);
CREATE POLICY "Anyone can read NBA games today" ON public.nba_games_today FOR SELECT USING (true);
CREATE POLICY "Anyone can read NBA props generated" ON public.nba_props_generated FOR SELECT USING (true);
CREATE POLICY "Anyone can read NBA stats refresh log" ON public.nba_stats_refresh_log FOR SELECT USING (true);

-- Service role insert/update policies (for edge functions)
CREATE POLICY "Service can manage NBA player stats" ON public.nba_player_stats FOR ALL USING (true);
CREATE POLICY "Service can manage NBA team stats" ON public.nba_team_stats FOR ALL USING (true);
CREATE POLICY "Service can manage NBA games today" ON public.nba_games_today FOR ALL USING (true);
CREATE POLICY "Service can manage NBA props generated" ON public.nba_props_generated FOR ALL USING (true);
CREATE POLICY "Service can manage NBA stats refresh log" ON public.nba_stats_refresh_log FOR ALL USING (true);

-- Index for fast lookups
CREATE INDEX idx_nba_props_game_date ON public.nba_props_generated(game_date);
CREATE INDEX idx_nba_props_recommendation ON public.nba_props_generated(recommendation);
CREATE INDEX idx_nba_props_confidence ON public.nba_props_generated(confidence_score DESC);
CREATE INDEX idx_nba_games_date ON public.nba_games_today(game_date);