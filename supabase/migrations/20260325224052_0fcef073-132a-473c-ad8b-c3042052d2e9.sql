
-- Polymarket Wallet Intelligence tables
CREATE TABLE IF NOT EXISTS public.sbo_pm_tracked_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL UNIQUE,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  priority_level TEXT NOT NULL DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_polled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.sbo_pm_wallet_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.sbo_pm_tracked_wallets(id) ON DELETE CASCADE,
  snapshot_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_positions_json JSONB,
  raw_activity_json JSONB,
  snapshot_hash TEXT
);

CREATE TABLE IF NOT EXISTS public.sbo_pm_wallet_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.sbo_pm_tracked_wallets(id) ON DELETE CASCADE,
  condition_id TEXT,
  market_question TEXT NOT NULL,
  side TEXT NOT NULL,
  size NUMERIC DEFAULT 0,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sbo_pm_wallet_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.sbo_pm_tracked_wallets(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  market_question TEXT NOT NULL,
  side TEXT,
  old_size NUMERIC DEFAULT 0,
  new_size NUMERIC DEFAULT 0,
  delta NUMERIC DEFAULT 0,
  event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  explanation TEXT
);

CREATE TABLE IF NOT EXISTS public.sbo_pm_wallet_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.sbo_pm_tracked_wallets(id) ON DELETE CASCADE UNIQUE,
  score NUMERIC NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'low',
  total_events INTEGER NOT NULL DEFAULT 0,
  last_activity TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pm_events_wallet ON public.sbo_pm_wallet_events(wallet_id);
CREATE INDEX IF NOT EXISTS idx_pm_events_time ON public.sbo_pm_wallet_events(event_time DESC);
CREATE INDEX IF NOT EXISTS idx_pm_positions_wallet ON public.sbo_pm_wallet_positions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_pm_snapshots_wallet ON public.sbo_pm_wallet_snapshots(wallet_id);

-- RLS
ALTER TABLE public.sbo_pm_tracked_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sbo_pm_wallet_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sbo_pm_wallet_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sbo_pm_wallet_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sbo_pm_wallet_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read sbo_pm_tracked_wallets" ON public.sbo_pm_tracked_wallets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert sbo_pm_tracked_wallets" ON public.sbo_pm_tracked_wallets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update sbo_pm_tracked_wallets" ON public.sbo_pm_tracked_wallets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete sbo_pm_tracked_wallets" ON public.sbo_pm_tracked_wallets FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read sbo_pm_wallet_snapshots" ON public.sbo_pm_wallet_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert sbo_pm_wallet_snapshots" ON public.sbo_pm_wallet_snapshots FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated read sbo_pm_wallet_positions" ON public.sbo_pm_wallet_positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert sbo_pm_wallet_positions" ON public.sbo_pm_wallet_positions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update sbo_pm_wallet_positions" ON public.sbo_pm_wallet_positions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read sbo_pm_wallet_events" ON public.sbo_pm_wallet_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert sbo_pm_wallet_events" ON public.sbo_pm_wallet_events FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated read sbo_pm_wallet_scores" ON public.sbo_pm_wallet_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert sbo_pm_wallet_scores" ON public.sbo_pm_wallet_scores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update sbo_pm_wallet_scores" ON public.sbo_pm_wallet_scores FOR UPDATE TO authenticated USING (true);
