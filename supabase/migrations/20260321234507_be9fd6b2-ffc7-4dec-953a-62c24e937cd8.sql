
-- NBA Games
create table if not exists sbo_games (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  sport text default 'basketball_nba',
  home_team text not null,
  away_team text not null,
  game_date timestamptz not null,
  status text default 'upcoming',
  home_score integer,
  away_score integer,
  winner text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Odds per game per sportsbook
create table if not exists sbo_odds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references sbo_games(id) on delete cascade,
  sportsbook text not null,
  market_type text not null,
  home_odds integer,
  away_odds integer,
  home_spread numeric,
  away_spread numeric,
  total_line numeric,
  over_odds integer,
  under_odds integer,
  fetched_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Player props
create table if not exists sbo_player_props (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references sbo_games(id) on delete cascade,
  player_name text not null,
  team text not null,
  prop_type text not null,
  line numeric not null,
  over_odds integer,
  under_odds integer,
  source text default 'prizepicks',
  entered_by text default 'va',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- AI Predictions
create table if not exists sbo_predictions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references sbo_games(id) on delete cascade,
  prop_id uuid references sbo_player_props(id),
  prediction_type text not null,
  predicted_outcome text not null,
  stats_brain_score integer,
  stats_brain_reasoning text,
  market_brain_score integer,
  market_brain_reasoning text,
  context_brain_score integer,
  context_brain_reasoning text,
  final_confidence integer,
  confidence_tier text,
  actual_outcome text,
  was_correct boolean,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Parlays
create table if not exists sbo_parlays (
  id uuid primary key default gen_random_uuid(),
  name text,
  legs jsonb not null default '[]',
  total_legs integer not null,
  combined_confidence integer,
  expected_value numeric,
  suggested_stake numeric,
  status text default 'pending',
  actual_payout numeric,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Simulations
create table if not exists sbo_simulations (
  id uuid primary key default gen_random_uuid(),
  parlay_id uuid references sbo_parlays(id),
  stake numeric not null,
  potential_payout numeric not null,
  win_probability numeric not null,
  expected_value numeric not null,
  simulation_count integer default 10000,
  simulated_wins integer,
  simulated_losses integer,
  kelly_stake numeric,
  legs_detail jsonb,
  created_at timestamptz default now()
);

-- VA entry sessions
create table if not exists sbo_va_sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null default current_date,
  entered_by text,
  props_entered integer default 0,
  games_covered integer default 0,
  notes text,
  created_at timestamptz default now()
);

-- Enable realtime
alter publication supabase_realtime add table sbo_predictions;
alter publication supabase_realtime add table sbo_odds;
