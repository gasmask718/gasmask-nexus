-- Create NBA moneyline predictions table (separate from player props)
CREATE TABLE public.nba_moneyline_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id TEXT NOT NULL,
  game_date DATE NOT NULL DEFAULT CURRENT_DATE,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  game_time TIMESTAMPTZ,
  
  -- Team ratings
  home_net_rating NUMERIC,
  away_net_rating NUMERIC,
  home_off_rating NUMERIC,
  away_off_rating NUMERIC,
  home_def_rating NUMERIC,
  away_def_rating NUMERIC,
  
  -- Context factors
  home_pace NUMERIC,
  away_pace NUMERIC,
  home_rest_days INTEGER DEFAULT 1,
  away_rest_days INTEGER DEFAULT 1,
  home_back_to_back BOOLEAN DEFAULT false,
  away_back_to_back BOOLEAN DEFAULT false,
  home_injury_impact NUMERIC DEFAULT 0,
  away_injury_impact NUMERIC DEFAULT 0,
  
  -- Prediction outputs (capped at 70% per guardrail)
  home_win_probability NUMERIC CHECK (home_win_probability <= 0.70),
  away_win_probability NUMERIC CHECK (away_win_probability <= 0.70),
  predicted_winner TEXT,
  confidence_score NUMERIC CHECK (confidence_score >= 0 AND confidence_score <= 100),
  
  -- Odds comparison
  home_implied_odds NUMERIC,
  away_implied_odds NUMERIC,
  edge_vs_market NUMERIC,
  
  -- Recommendation
  recommendation TEXT CHECK (recommendation IN ('strong_lean', 'lean', 'slight_lean', 'no_edge', 'avoid')),
  reasoning TEXT,
  calibration_factors JSONB DEFAULT '{}'::jsonb,
  
  -- Metadata
  generated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(game_id, game_date)
);

-- Enable RLS
ALTER TABLE public.nba_moneyline_predictions ENABLE ROW LEVEL SECURITY;

-- Read policy for authenticated users
CREATE POLICY "Users can read moneyline predictions"
ON public.nba_moneyline_predictions
FOR SELECT
TO authenticated
USING (true);

-- Admin/owner write policy
CREATE POLICY "Admins can manage moneyline predictions"
ON public.nba_moneyline_predictions
FOR ALL
USING (
  public.is_admin(auth.uid()) OR public.is_owner(auth.uid())
);

-- Index for fast date queries
CREATE INDEX idx_moneyline_game_date ON public.nba_moneyline_predictions(game_date);
CREATE INDEX idx_moneyline_recommendation ON public.nba_moneyline_predictions(recommendation);