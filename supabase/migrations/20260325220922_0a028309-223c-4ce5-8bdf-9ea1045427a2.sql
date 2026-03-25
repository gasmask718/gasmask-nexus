
-- External Intelligence Layer for SBO AI Engine

-- Tracked wallets (Polymarket / on-chain sharp money)
CREATE TABLE IF NOT EXISTS sbo_tracked_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL UNIQUE,
  label text,
  tier text NOT NULL DEFAULT 'unproven' CHECK (tier IN ('elite', 'good', 'unproven')),
  win_rate numeric DEFAULT 0,
  total_bets integer DEFAULT 0,
  profit_estimate numeric DEFAULT 0,
  roi_pct numeric DEFAULT 0,
  last_activity timestamptz,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Wallet activity log
CREATE TABLE IF NOT EXISTS sbo_wallet_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid REFERENCES sbo_tracked_wallets(id) ON DELETE CASCADE NOT NULL,
  market text NOT NULL,
  position text NOT NULL,
  size numeric,
  odds numeric,
  tx_hash text,
  result text DEFAULT 'pending' CHECK (result IN ('pending', 'won', 'lost', 'push')),
  profit_loss numeric,
  detected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Telegram / external cappers
CREATE TABLE IF NOT EXISTS sbo_cappers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source text NOT NULL DEFAULT 'telegram',
  source_handle text,
  tier text NOT NULL DEFAULT 'unproven' CHECK (tier IN ('elite', 'good', 'unproven')),
  win_rate numeric DEFAULT 0,
  total_picks integer DEFAULT 0,
  roi_pct numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Capper pick log
CREATE TABLE IF NOT EXISTS sbo_capper_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capper_id uuid REFERENCES sbo_cappers(id) ON DELETE CASCADE NOT NULL,
  pick_text text NOT NULL,
  player_name text,
  team text,
  prop_type text,
  line numeric,
  direction text,
  odds integer,
  stake numeric,
  result text DEFAULT 'pending' CHECK (result IN ('pending', 'won', 'lost', 'push')),
  profit_loss numeric,
  game_date date,
  parsed_by_ai boolean DEFAULT false,
  raw_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE sbo_tracked_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sbo_wallet_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE sbo_cappers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sbo_capper_picks ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access
CREATE POLICY "Authenticated users can manage wallets" ON sbo_tracked_wallets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage wallet activity" ON sbo_wallet_activity FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage cappers" ON sbo_cappers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage capper picks" ON sbo_capper_picks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wallet_activity_wallet ON sbo_wallet_activity(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_activity_detected ON sbo_wallet_activity(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_capper_picks_capper ON sbo_capper_picks(capper_id);
CREATE INDEX IF NOT EXISTS idx_capper_picks_date ON sbo_capper_picks(game_date DESC);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE sbo_wallet_activity;
ALTER PUBLICATION supabase_realtime ADD TABLE sbo_capper_picks;
