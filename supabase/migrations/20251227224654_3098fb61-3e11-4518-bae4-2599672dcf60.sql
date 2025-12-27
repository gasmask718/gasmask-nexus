-- Create enums for betting system
DO $$ BEGIN
  CREATE TYPE public.market_type AS ENUM ('spread', 'total', 'moneyline', 'player_prop', 'fantasy_prop');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.bet_status AS ENUM ('simulated', 'approved', 'rejected', 'executed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.bet_result AS ENUM ('pending', 'win', 'loss', 'push', 'void');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.parlay_type AS ENUM ('sportsbook', 'pickem');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 1. market_lines table
CREATE TABLE IF NOT EXISTS public.market_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  sport TEXT NOT NULL,
  league TEXT,
  event TEXT NOT NULL,
  market_type public.market_type NOT NULL,
  player_name TEXT,
  stat_type TEXT,
  line_value NUMERIC(10,2),
  over_under TEXT,
  odds_or_payout NUMERIC(10,2),
  event_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. bets_simulated table
CREATE TABLE IF NOT EXISTS public.bets_simulated (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'ai_model',
  platform TEXT NOT NULL,
  market_line_id UUID REFERENCES public.market_lines(id) ON DELETE SET NULL,
  bet_type TEXT NOT NULL,
  description TEXT,
  estimated_probability NUMERIC(5,2),
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  simulated_roi NUMERIC(8,4),
  volatility_score NUMERIC(5,2),
  status public.bet_status DEFAULT 'simulated',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. bets_executed table
CREATE TABLE IF NOT EXISTS public.bets_executed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulated_bet_id UUID REFERENCES public.bets_simulated(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  odds_received NUMERIC(10,2),
  stake_units NUMERIC(10,2) NOT NULL,
  execution_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
  result public.bet_result DEFAULT 'pending',
  profit_units NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. parlays table
CREATE TABLE IF NOT EXISTS public.parlays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parlay_type public.parlay_type NOT NULL,
  legs UUID[] NOT NULL,
  platform TEXT NOT NULL,
  payout_structure JSONB,
  estimated_probability NUMERIC(8,4),
  simulated_roi NUMERIC(8,4),
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  status public.bet_status DEFAULT 'simulated',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. simulation_runs table
CREATE TABLE IF NOT EXISTS public.simulation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_name TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  markets_included TEXT[],
  platforms_included TEXT[],
  total_bets INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  roi NUMERIC(8,4),
  drawdown NUMERIC(8,4),
  peak_profit NUMERIC(10,2),
  notes TEXT,
  status TEXT DEFAULT 'running',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.market_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bets_simulated ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bets_executed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parlays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_runs ENABLE ROW LEVEL SECURITY;

-- market_lines policies
CREATE POLICY "market_lines_select" ON public.market_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "market_lines_insert" ON public.market_lines FOR INSERT TO authenticated WITH CHECK (public.is_owner(auth.uid()) OR public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'va'));
CREATE POLICY "market_lines_update" ON public.market_lines FOR UPDATE TO authenticated USING (public.is_owner(auth.uid()) OR public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'va'));
CREATE POLICY "market_lines_delete" ON public.market_lines FOR DELETE TO authenticated USING (public.is_owner(auth.uid()) OR public.is_admin(auth.uid()));

-- bets_simulated policies
CREATE POLICY "bets_simulated_select" ON public.bets_simulated FOR SELECT TO authenticated USING (true);
CREATE POLICY "bets_simulated_insert" ON public.bets_simulated FOR INSERT TO authenticated WITH CHECK (public.is_owner(auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "bets_simulated_update" ON public.bets_simulated FOR UPDATE TO authenticated USING (public.is_owner(auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "bets_simulated_delete" ON public.bets_simulated FOR DELETE TO authenticated USING (public.is_owner(auth.uid()) OR public.is_admin(auth.uid()));

-- bets_executed policies
CREATE POLICY "bets_executed_select" ON public.bets_executed FOR SELECT TO authenticated USING (public.is_owner(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "bets_executed_insert" ON public.bets_executed FOR INSERT TO authenticated WITH CHECK (public.is_owner(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "bets_executed_update" ON public.bets_executed FOR UPDATE TO authenticated USING (public.is_owner(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "bets_executed_delete" ON public.bets_executed FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

-- parlays policies
CREATE POLICY "parlays_select" ON public.parlays FOR SELECT TO authenticated USING (true);
CREATE POLICY "parlays_insert" ON public.parlays FOR INSERT TO authenticated WITH CHECK (public.is_owner(auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "parlays_update" ON public.parlays FOR UPDATE TO authenticated USING (public.is_owner(auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "parlays_delete" ON public.parlays FOR DELETE TO authenticated USING (public.is_owner(auth.uid()) OR public.is_admin(auth.uid()));

-- simulation_runs policies
CREATE POLICY "simulation_runs_select" ON public.simulation_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "simulation_runs_insert" ON public.simulation_runs FOR INSERT TO authenticated WITH CHECK (public.is_owner(auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "simulation_runs_update" ON public.simulation_runs FOR UPDATE TO authenticated USING (public.is_owner(auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "simulation_runs_delete" ON public.simulation_runs FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_market_lines_platform ON public.market_lines(platform);
CREATE INDEX IF NOT EXISTS idx_market_lines_sport ON public.market_lines(sport);
CREATE INDEX IF NOT EXISTS idx_market_lines_event_time ON public.market_lines(event_time);
CREATE INDEX IF NOT EXISTS idx_bets_simulated_status ON public.bets_simulated(status);
CREATE INDEX IF NOT EXISTS idx_bets_executed_result ON public.bets_executed(result);
CREATE INDEX IF NOT EXISTS idx_bets_executed_user ON public.bets_executed(user_id);
CREATE INDEX IF NOT EXISTS idx_parlays_status ON public.parlays(status);
CREATE INDEX IF NOT EXISTS idx_simulation_runs_status ON public.simulation_runs(status);