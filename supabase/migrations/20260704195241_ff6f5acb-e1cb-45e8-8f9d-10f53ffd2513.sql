
-- SBO Multi-Sport Expansion — STEP 1
CREATE TABLE IF NOT EXISTS public.sbo_sports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_key text UNIQUE NOT NULL,
  sport_name text NOT NULL,
  is_active boolean DEFAULT true,
  season_start date,
  season_end date,
  stats_weight numeric DEFAULT 40,
  market_weight numeric DEFAULT 35,
  context_weight numeric DEFAULT 25,
  learned_stats_weight numeric,
  learned_market_weight numeric,
  learned_context_weight numeric,
  total_predictions integer DEFAULT 0,
  correct_predictions integer DEFAULT 0,
  accuracy_rate numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.sbo_sports TO anon, authenticated;
GRANT ALL ON public.sbo_sports TO service_role;
ALTER TABLE public.sbo_sports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sbo_sports read all" ON public.sbo_sports;
CREATE POLICY "sbo_sports read all" ON public.sbo_sports FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.sbo_prop_accuracy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_key text NOT NULL,
  prop_type text NOT NULL,
  over_total integer DEFAULT 0,
  over_correct integer DEFAULT 0,
  under_total integer DEFAULT 0,
  under_correct integer DEFAULT 0,
  elite_total integer DEFAULT 0,
  elite_correct integer DEFAULT 0,
  strong_total integer DEFAULT 0,
  strong_correct integer DEFAULT 0,
  moderate_total integer DEFAULT 0,
  moderate_correct integer DEFAULT 0,
  weak_total integer DEFAULT 0,
  weak_correct integer DEFAULT 0,
  best_line_min numeric,
  best_line_max numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(sport_key, prop_type)
);
GRANT SELECT ON public.sbo_prop_accuracy TO anon, authenticated;
GRANT ALL ON public.sbo_prop_accuracy TO service_role;
ALTER TABLE public.sbo_prop_accuracy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sbo_prop_accuracy read all" ON public.sbo_prop_accuracy;
CREATE POLICY "sbo_prop_accuracy read all" ON public.sbo_prop_accuracy FOR SELECT USING (true);

-- sbo_weight_history already exists in this project; leave it untouched.

-- Additive sport_key columns (default 'nba' preserves existing data)
ALTER TABLE public.sbo_games        ADD COLUMN IF NOT EXISTS sport_key text DEFAULT 'nba';
ALTER TABLE public.sbo_predictions  ADD COLUMN IF NOT EXISTS sport_key text DEFAULT 'nba';
ALTER TABLE public.sbo_player_props ADD COLUMN IF NOT EXISTS sport_key text DEFAULT 'nba';
ALTER TABLE public.sbo_odds         ADD COLUMN IF NOT EXISTS sport_key text DEFAULT 'nba';
ALTER TABLE public.sbo_accuracy_log ADD COLUMN IF NOT EXISTS sport_key text DEFAULT 'nba';
ALTER TABLE public.sbo_accuracy_log ADD COLUMN IF NOT EXISTS prop_breakdown jsonb;

CREATE INDEX IF NOT EXISTS idx_sbo_games_sport_key        ON public.sbo_games(sport_key);
CREATE INDEX IF NOT EXISTS idx_sbo_predictions_sport_key  ON public.sbo_predictions(sport_key);
CREATE INDEX IF NOT EXISTS idx_sbo_player_props_sport_key ON public.sbo_player_props(sport_key);
CREATE INDEX IF NOT EXISTS idx_sbo_odds_sport_key         ON public.sbo_odds(sport_key);

-- Seed sport configs
INSERT INTO public.sbo_sports (sport_key, sport_name, stats_weight, market_weight, context_weight, is_active) VALUES
  ('nba','NBA Basketball',40,35,25,true),
  ('nfl','NFL Football',45,30,25,true),
  ('mlb','MLB Baseball',50,30,20,true),
  ('nhl','NHL Hockey',45,35,20,true),
  ('mma','MMA/UFC',35,35,30,true),
  ('soccer_epl','EPL Soccer',40,35,25,false),
  ('ncaab','College Basketball',45,30,25,false),
  ('ncaaf','College Football',45,30,25,false)
ON CONFLICT (sport_key) DO NOTHING;
