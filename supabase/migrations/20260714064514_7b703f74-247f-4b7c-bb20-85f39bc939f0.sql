-- ============ TABLE 1: sbo_signals ============
CREATE TABLE public.sbo_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport text,
  game text,
  home_team text,
  away_team text,
  game_date date,
  game_time time,
  pick_type text,
  pick_detail text,
  side text,
  line numeric,
  odds integer DEFAULT -110,
  internal_confidence integer DEFAULT 0,
  combined_confidence integer DEFAULT 0,
  confirming_cappers jsonb DEFAULT '[]'::jsonb,
  fading_cappers jsonb DEFAULT '[]'::jsonb,
  signal_grade text CHECK (signal_grade IN ('LOCK','BEST_BET','PLAY','LEAN','NO_PLAY')),
  result text CHECK (result IN ('win','loss','push','pending')) DEFAULT 'pending',
  pnl_units numeric,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sbo_signals TO authenticated;
GRANT ALL ON public.sbo_signals TO service_role;
ALTER TABLE public.sbo_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and owners full access" ON public.sbo_signals
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role));

-- ============ TABLE 2: sbo_sport_performance ============
CREATE TABLE public.sbo_sport_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport text NOT NULL,
  week_start date NOT NULL,
  spread_picks integer DEFAULT 0,
  spread_wins integer DEFAULT 0,
  spread_losses integer DEFAULT 0,
  spread_pushes integer DEFAULT 0,
  spread_win_rate numeric,
  spread_units_pnl numeric DEFAULT 0,
  total_picks integer DEFAULT 0,
  total_wins integer DEFAULT 0,
  total_losses integer DEFAULT 0,
  total_win_rate numeric,
  total_units_pnl numeric DEFAULT 0,
  ml_picks integer DEFAULT 0,
  ml_wins integer DEFAULT 0,
  ml_losses integer DEFAULT 0,
  ml_units_pnl numeric DEFAULT 0,
  prop_picks integer DEFAULT 0,
  prop_wins integer DEFAULT 0,
  prop_losses integer DEFAULT 0,
  prop_win_rate numeric,
  prop_units_pnl numeric DEFAULT 0,
  overall_win_rate numeric,
  overall_units_pnl numeric DEFAULT 0,
  min_confidence_threshold integer DEFAULT 60,
  ai_notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (sport, week_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sbo_sport_performance TO authenticated;
GRANT ALL ON public.sbo_sport_performance TO service_role;
ALTER TABLE public.sbo_sport_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and owners full access" ON public.sbo_sport_performance
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role));

-- ============ TABLE 3: sbo_prop_picks ============
CREATE TABLE public.sbo_prop_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport text,
  game text,
  game_date date,
  player_name text,
  team text,
  prop_stat text,
  line numeric,
  side text CHECK (side IN ('over','under')),
  odds integer DEFAULT -115,
  source text,
  internal_confidence integer,
  capper_confirmation boolean DEFAULT false,
  confirming_cappers text[],
  combined_confidence integer,
  player_season_avg numeric,
  player_last_5_avg numeric,
  player_vs_opponent_avg numeric,
  matchup_advantage text,
  injury_flag boolean DEFAULT false,
  injury_notes text,
  result text CHECK (result IN ('win','loss','push','pending')) DEFAULT 'pending',
  actual_value numeric,
  pnl_units numeric,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sbo_prop_picks TO authenticated;
GRANT ALL ON public.sbo_prop_picks TO service_role;
ALTER TABLE public.sbo_prop_picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and owners full access" ON public.sbo_prop_picks
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role));

-- ============ TABLE 4: sbo_weekly_reports ============
CREATE TABLE public.sbo_weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date UNIQUE,
  week_start date,
  week_end date,
  total_picks integer DEFAULT 0,
  total_wins integer DEFAULT 0,
  overall_win_rate numeric,
  overall_units_pnl numeric DEFAULT 0,
  best_sport text,
  worst_sport text,
  best_capper text,
  sport_breakdown jsonb,
  capper_breakdown jsonb,
  prop_performance jsonb,
  capper_weight_changes jsonb,
  ai_narrative text,
  recommendations jsonb,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sbo_weekly_reports TO authenticated;
GRANT ALL ON public.sbo_weekly_reports TO service_role;
ALTER TABLE public.sbo_weekly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and owners full access" ON public.sbo_weekly_reports
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role));