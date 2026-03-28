
-- Market Performance Tracking Table
CREATE TABLE public.sbo_market_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  sport text NOT NULL,
  market_type text NOT NULL DEFAULT 'prop',
  win_rate numeric DEFAULT 0,
  roi numeric DEFAULT 0,
  total_bets integer DEFAULT 0,
  wins integer DEFAULT 0,
  losses integer DEFAULT 0,
  pushes integer DEFAULT 0,
  avg_odds numeric DEFAULT -110,
  current_weight numeric DEFAULT 1.0,
  auto_weight_enabled boolean DEFAULT true,
  last_recalc_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, sport, market_type)
);

ALTER TABLE public.sbo_market_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own market performance"
  ON public.sbo_market_performance
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add market_type to bet_log if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sbo_bet_log' AND column_name = 'market_type') THEN
    ALTER TABLE public.sbo_bet_log ADD COLUMN market_type text DEFAULT 'prop';
  END IF;
END $$;
