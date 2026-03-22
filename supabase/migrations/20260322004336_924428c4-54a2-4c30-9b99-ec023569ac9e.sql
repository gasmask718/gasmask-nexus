
-- Player season averages (refreshed daily)
create table if not exists sbo_player_season_stats (
  id uuid primary key default gen_random_uuid(),
  player_id integer not null,
  player_name text not null,
  team text,
  team_id integer,
  season integer not null,
  position text,
  games_played integer default 0,
  minutes_per_game numeric default 0,
  points_avg numeric default 0,
  assists_avg numeric default 0,
  rebounds_avg numeric default 0,
  steals_avg numeric default 0,
  blocks_avg numeric default 0,
  threes_avg numeric default 0,
  turnovers_avg numeric default 0,
  field_goal_pct numeric default 0,
  three_point_pct numeric default 0,
  free_throw_pct numeric default 0,
  true_shooting_pct numeric default 0,
  usage_rate numeric default 0,
  fantasy_points_avg numeric default 0,
  updated_at timestamptz default now(),
  unique(player_id, season)
);

-- Player game logs (appended after each game)
create table if not exists sbo_player_game_logs (
  id uuid primary key default gen_random_uuid(),
  player_id integer not null,
  player_name text not null,
  team text,
  game_id integer,
  game_date date not null,
  opponent text,
  home_away text,
  started boolean default false,
  minutes numeric,
  points integer,
  assists integer,
  rebounds integer,
  steals integer,
  blocks integer,
  threes integer,
  turnovers integer,
  field_goals_made integer,
  field_goals_attempted integer,
  free_throws_made integer,
  free_throws_attempted integer,
  fantasy_points numeric,
  plus_minus integer,
  win boolean,
  created_at timestamptz default now(),
  unique(player_id, game_id)
);

-- Team stats (refreshed daily)
create table if not exists sbo_team_stats (
  id uuid primary key default gen_random_uuid(),
  team_id integer not null,
  team_name text not null,
  team_key text,
  season integer not null,
  wins integer default 0,
  losses integer default 0,
  points_per_game numeric default 0,
  opponent_points_per_game numeric default 0,
  pace numeric default 0,
  offensive_rating numeric default 0,
  defensive_rating numeric default 0,
  three_point_attempts_per_game numeric default 0,
  rebounds_per_game numeric default 0,
  assists_per_game numeric default 0,
  turnovers_per_game numeric default 0,
  home_wins integer default 0,
  home_losses integer default 0,
  away_wins integer default 0,
  away_losses integer default 0,
  last_10_wins integer default 0,
  updated_at timestamptz default now(),
  unique(team_id, season)
);

-- Injuries (refreshed every 2 hours)
create table if not exists sbo_injuries (
  id uuid primary key default gen_random_uuid(),
  player_id integer not null unique,
  player_name text not null,
  team text,
  status text,
  injury_type text,
  body_part text,
  practice_status text,
  start_date date,
  expected_return date,
  notes text,
  is_active boolean default true,
  updated_at timestamptz default now()
);

-- Pre-game projections (refreshed every 10 min pre-game)
create table if not exists sbo_player_projections (
  id uuid primary key default gen_random_uuid(),
  player_id integer not null,
  player_name text not null,
  team text,
  game_id integer,
  game_date date not null,
  opponent text,
  projected_minutes numeric,
  projected_points numeric,
  projected_assists numeric,
  projected_rebounds numeric,
  projected_steals numeric,
  projected_blocks numeric,
  projected_threes numeric,
  projected_turnovers numeric,
  projected_fantasy_points numeric,
  draftkings_salary integer,
  fanduel_salary integer,
  updated_at timestamptz default now(),
  unique(player_id, game_date)
);

-- Props from SportsDataIO (all sportsbooks)
create table if not exists sbo_sdio_props (
  id uuid primary key default gen_random_uuid(),
  game_id integer,
  game_date date not null,
  player_id integer,
  player_name text not null,
  team text,
  opponent text,
  sportsbook text,
  bet_type text,
  over_under text,
  value numeric,
  over_payout integer,
  under_payout integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Defense vs position
create table if not exists sbo_defense_vs_position (
  id uuid primary key default gen_random_uuid(),
  team_id integer not null,
  team_name text not null,
  season integer not null,
  position text not null,
  fantasy_points_allowed numeric,
  points_allowed_avg numeric,
  assists_allowed_avg numeric,
  rebounds_allowed_avg numeric,
  rank_points integer,
  rank_fantasy integer,
  updated_at timestamptz default now(),
  unique(team_id, season, position)
);

-- Sync log
create table if not exists sbo_sync_log (
  id uuid primary key default gen_random_uuid(),
  feed_name text not null,
  last_synced_at timestamptz,
  records_synced integer,
  status text default 'success',
  error_message text,
  created_at timestamptz default now()
);
