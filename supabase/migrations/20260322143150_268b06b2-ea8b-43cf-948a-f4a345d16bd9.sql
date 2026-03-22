
create table sbo_hedge_engine (
  id uuid primary key default gen_random_uuid(),
  game_id text,
  phase text,
  pregame_pick text,
  pregame_odds text,
  pregame_stake numeric,
  pregame_book text,
  pregame_potential_payout numeric,
  hedge_pick text,
  hedge_odds text,
  hedge_stake numeric,
  hedge_book text,
  hedge_potential_payout numeric,
  guaranteed_profit numeric,
  guaranteed_profit_pct numeric,
  worst_case_loss numeric,
  best_case_profit numeric,
  hedge_efficiency numeric,
  hedge_trigger text,
  hedge_triggered boolean default false,
  hedge_triggered_at timestamptz,
  actual_profit numeric,
  result text default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table sbo_arbitrage (
  id uuid primary key default gen_random_uuid(),
  game_id text,
  bet_type text,
  side_a_pick text,
  side_a_book text,
  side_a_odds text,
  side_a_stake numeric,
  side_a_payout numeric,
  side_b_pick text,
  side_b_book text,
  side_b_odds text,
  side_b_stake numeric,
  side_b_payout numeric,
  total_stake numeric,
  guaranteed_profit numeric,
  arb_percentage numeric,
  window_open_at timestamptz,
  window_closed_at timestamptz,
  executed boolean default false,
  created_at timestamptz default now()
);

create table sbo_daily_profit_plan (
  id uuid primary key default gen_random_uuid(),
  plan_date date default current_date,
  target_profit numeric,
  guaranteed_profit numeric,
  projected_profit numeric,
  total_capital_required numeric,
  total_stakes numeric,
  bets jsonb,
  hedges jsonb,
  books_needed jsonb,
  status text default 'planned',
  actual_profit numeric,
  created_at timestamptz default now()
);

create table sbo_user_books (
  id uuid primary key default gen_random_uuid(),
  book_name text,
  account_balance numeric,
  is_active boolean default true,
  best_for text,
  notes text,
  added_at timestamptz default now()
);
