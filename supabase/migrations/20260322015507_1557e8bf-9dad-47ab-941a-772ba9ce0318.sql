
create table if not exists sbo_daily_briefings (
  id uuid primary key default gen_random_uuid(),
  briefing_date date not null unique,
  sent_at timestamptz,
  phone_number text not null,
  moneylines_section text,
  props_section text,
  parlay_section text,
  full_message text,
  top_moneylines jsonb default '[]',
  top_props jsonb default '[]',
  parlay_legs jsonb default '[]',
  games_tonight integer default 0,
  props_available integer default 0,
  best_parlay_confidence numeric default 0,
  status text default 'pending',
  error_message text,
  created_at timestamptz default now()
);

create table if not exists sbo_actual_bets (
  id uuid primary key default gen_random_uuid(),
  briefing_id uuid references sbo_daily_briefings(id),
  bet_date date not null default current_date,
  bet_type text not null,
  description text not null,
  legs jsonb default '[]',
  stake_usd numeric not null,
  odds_american integer,
  parlay_legs_count integer,
  potential_payout numeric,
  outcome text,
  actual_payout numeric default 0,
  profit_loss numeric,
  raw_reply text,
  parsed_by_ai boolean default false,
  confirmed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists sbo_bankroll (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null default current_date,
  starting_bankroll numeric default 0,
  total_wagered numeric default 0,
  total_won numeric default 0,
  total_lost numeric default 0,
  net_profit_loss numeric default 0,
  roi_pct numeric default 0,
  win_count integer default 0,
  loss_count integer default 0,
  push_count integer default 0,
  win_rate_pct numeric default 0,
  biggest_win numeric default 0,
  biggest_loss numeric default 0,
  current_streak integer default 0,
  streak_type text default 'none',
  updated_at timestamptz default now()
);

create table if not exists sbo_sms_log (
  id uuid primary key default gen_random_uuid(),
  direction text not null,
  phone_number text not null,
  message_body text not null,
  twilio_sid text,
  briefing_id uuid references sbo_daily_briefings(id),
  related_bet_id uuid references sbo_actual_bets(id),
  processed boolean default false,
  created_at timestamptz default now()
);

create table if not exists sbo_parlay_payouts (
  id uuid primary key default gen_random_uuid(),
  briefing_id uuid references sbo_daily_briefings(id),
  legs_count integer not null,
  leg_details jsonb not null,
  combined_odds integer,
  parlay_multiplier numeric,
  payout_5 numeric,
  payout_10 numeric,
  payout_20 numeric,
  payout_25 numeric,
  payout_50 numeric,
  payout_100 numeric,
  win_probability_pct numeric,
  expected_value_10 numeric,
  created_at timestamptz default now()
);

alter publication supabase_realtime add table sbo_actual_bets;
alter publication supabase_realtime add table sbo_bankroll;
