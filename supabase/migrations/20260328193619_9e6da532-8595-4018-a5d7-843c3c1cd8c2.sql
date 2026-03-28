
-- Betting wallet for bankroll tracking
CREATE TABLE public.sbo_betting_wallet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bankroll numeric NOT NULL DEFAULT 1000,
  total_wagered numeric NOT NULL DEFAULT 0,
  total_profit numeric NOT NULL DEFAULT 0,
  total_bets integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  pushes integer NOT NULL DEFAULT 0,
  max_daily_loss_pct numeric NOT NULL DEFAULT 10,
  max_bets_per_day integer NOT NULL DEFAULT 15,
  streak_multiplier boolean NOT NULL DEFAULT true,
  auto_bet_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.sbo_betting_wallet ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own wallet" ON public.sbo_betting_wallet FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Bet log for every placed bet
CREATE TABLE public.sbo_bet_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  prop_id uuid,
  player_name text NOT NULL,
  stat_type text,
  line numeric,
  direction text,
  odds numeric DEFAULT -110,
  stake numeric NOT NULL,
  potential_payout numeric,
  result text NOT NULL DEFAULT 'pending',
  profit numeric DEFAULT 0,
  composite_score numeric,
  signal_type text,
  sharp_indicator text,
  is_lock_play boolean DEFAULT false,
  auto_placed boolean DEFAULT false,
  strategy text,
  notes text,
  game_date date NOT NULL DEFAULT CURRENT_DATE,
  placed_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);

ALTER TABLE public.sbo_bet_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own bets" ON public.sbo_bet_log FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Daily performance snapshots
CREATE TABLE public.sbo_daily_report (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  total_bets integer DEFAULT 0,
  wins integer DEFAULT 0,
  losses integer DEFAULT 0,
  total_wagered numeric DEFAULT 0,
  total_profit numeric DEFAULT 0,
  roi_pct numeric DEFAULT 0,
  best_strategy text,
  best_strategy_roi numeric DEFAULT 0,
  bankroll_start numeric DEFAULT 0,
  bankroll_end numeric DEFAULT 0,
  stop_loss_hit boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, report_date)
);

ALTER TABLE public.sbo_daily_report ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own reports" ON public.sbo_daily_report FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Strategy performance tracker
CREATE TABLE public.sbo_strategy_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  strategy text NOT NULL,
  total_bets integer DEFAULT 0,
  wins integer DEFAULT 0,
  losses integer DEFAULT 0,
  total_profit numeric DEFAULT 0,
  roi_pct numeric DEFAULT 0,
  current_weight numeric DEFAULT 0.25,
  last_updated timestamptz DEFAULT now(),
  UNIQUE(user_id, strategy)
);

ALTER TABLE public.sbo_strategy_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own strategies" ON public.sbo_strategy_performance FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
