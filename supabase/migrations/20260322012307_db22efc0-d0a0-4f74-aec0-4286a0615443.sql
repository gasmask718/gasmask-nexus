
-- Polymarket markets table
create table if not exists sbo_polymarket (
  id uuid primary key default gen_random_uuid(),
  market_id text unique not null,
  question text not null,
  category text default 'nba',
  game_id uuid references sbo_games(id),
  outcome_yes_price numeric,
  outcome_no_price numeric,
  home_team_price numeric,
  away_team_price numeric,
  volume_usd numeric default 0,
  liquidity_usd numeric default 0,
  status text default 'open',
  resolution text,
  end_date timestamptz,
  raw_data jsonb,
  fetched_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Polymarket signal tracking
create table if not exists sbo_polymarket_signals (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid references sbo_predictions(id),
  market_id text,
  signal_strength numeric,
  price_used numeric,
  volume_used numeric,
  interpretation text,
  created_at timestamptz default now()
);

-- Add Polymarket brain columns to predictions
alter table sbo_predictions
  add column if not exists polymarket_brain_score integer,
  add column if not exists polymarket_brain_reasoning text,
  add column if not exists brain_count integer default 3;

-- Accuracy log for daily tracking
create table if not exists sbo_accuracy_log (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  total_predictions integer default 0,
  correct_predictions integer default 0,
  accuracy_pct numeric default 0,
  by_tier jsonb default '{}',
  by_type jsonb default '{}',
  created_at timestamptz default now()
);
