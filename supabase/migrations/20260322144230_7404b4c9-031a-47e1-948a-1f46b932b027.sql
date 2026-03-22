
-- Upgrade 1: CLV Tracker
create table if not exists sbo_clv_tracker (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid references sbo_predictions(id),
  game_id text,
  our_pick text,
  odds_when_predicted text,
  closing_odds text,
  clv_value numeric,
  clv_percentage numeric,
  verdict text,
  recorded_at timestamptz default now()
);

-- Upgrade 3: Kelly Unit Log
create table if not exists sbo_unit_log (
  id uuid primary key default gen_random_uuid(),
  pick_id uuid,
  units_wagered numeric,
  kelly_recommended numeric,
  actual_stake numeric,
  result text default 'pending',
  profit_loss numeric,
  bankroll_after numeric,
  logged_at timestamptz default now()
);

-- Add bankroll columns
alter table sbo_bankroll add column if not exists current_bankroll numeric default 500;
alter table sbo_bankroll add column if not exists starting_bankroll numeric default 500;
alter table sbo_bankroll add column if not exists peak_bankroll numeric default 500;
alter table sbo_bankroll add column if not exists units numeric default 1;
alter table sbo_bankroll add column if not exists unit_size numeric default 10;
alter table sbo_bankroll add column if not exists kelly_fraction numeric default 0.25;

-- Upgrade 5: Calibration Model
create table if not exists sbo_calibration (
  id uuid primary key default gen_random_uuid(),
  confidence_bucket text,
  total_picks int default 0,
  correct_picks int default 0,
  actual_accuracy numeric,
  expected_accuracy numeric,
  calibration_score numeric,
  last_updated timestamptz default now()
);

-- Upgrade 6: Game Intelligence
create table if not exists sbo_game_intelligence (
  id uuid primary key default gen_random_uuid(),
  game_id text,
  injury_report jsonb,
  rest_days_home int,
  rest_days_away int,
  back_to_back_home boolean default false,
  back_to_back_away boolean default false,
  home_record_home text,
  away_record_away text,
  ats_record_home text,
  ats_record_away text,
  last_5_home jsonb,
  last_5_away jsonb,
  head_to_head jsonb,
  pace_home numeric,
  pace_away numeric,
  offensive_rating_home numeric,
  defensive_rating_home numeric,
  offensive_rating_away numeric,
  defensive_rating_away numeric,
  created_at timestamptz default now()
);

-- Upgrade 7: Live In-Game Picks
create table if not exists sbo_live_picks (
  id uuid primary key default gen_random_uuid(),
  game_id text,
  quarter int,
  clock text,
  current_score_home int,
  current_score_away int,
  live_line text,
  live_total text,
  ai_live_pick text,
  ai_live_confidence int,
  ai_live_analysis text,
  momentum_indicator text,
  created_at timestamptz default now()
);

-- Upgrade 8: Prop Correlations
create table if not exists sbo_prop_correlations (
  id uuid primary key default gen_random_uuid(),
  prop_a_id uuid,
  prop_b_id uuid,
  correlation_score numeric,
  correlation_type text,
  reasoning text,
  historical_hit_rate numeric,
  created_at timestamptz default now()
);

-- Upgrade 9: Bettor Profile
create table if not exists sbo_bettor_profile (
  id uuid primary key default gen_random_uuid(),
  overall_edge_score numeric,
  sharp_rating text,
  strongest_bet_type text,
  weakest_bet_type text,
  best_sport text,
  best_confidence_tier text,
  avg_clv numeric,
  roi_7d numeric,
  roi_30d numeric,
  roi_all_time numeric,
  total_units_wagered numeric,
  total_units_won numeric,
  longest_win_streak int,
  longest_loss_streak int,
  updated_at timestamptz default now()
);

-- Upgrade 10: Wealth Engine Sync
create table if not exists sbo_wealth_sync (
  id uuid primary key default gen_random_uuid(),
  period text,
  gross_profit numeric,
  gross_loss numeric,
  net_profit numeric,
  roi numeric,
  units_won numeric,
  best_pick text,
  worst_pick text,
  synced_to_wealth_engine boolean default false,
  synced_at timestamptz,
  created_at timestamptz default now()
);

-- Add sharp/kelly fields to sbo_predictions
alter table sbo_predictions add column if not exists kelly_stake numeric;
alter table sbo_predictions add column if not exists recommended_units numeric;
alter table sbo_predictions add column if not exists recommended_stake numeric;
alter table sbo_predictions add column if not exists clv_tracked boolean default false;
alter table sbo_predictions add column if not exists sharp_indicator boolean default false;

-- Add sharp fields to sbo_line_movement
alter table sbo_line_movement add column if not exists sharp_percentage_home int;
alter table sbo_line_movement add column if not exists sharp_percentage_away int;
alter table sbo_line_movement add column if not exists steam_move boolean default false;
alter table sbo_line_movement add column if not exists reverse_line_move boolean default false;
alter table sbo_line_movement add column if not exists public_percentage_home int;
alter table sbo_line_movement add column if not exists public_percentage_away int;
