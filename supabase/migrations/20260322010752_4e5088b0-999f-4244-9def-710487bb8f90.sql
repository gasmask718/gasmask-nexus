
-- API cost tracking per sync run
create table if not exists sbo_api_costs (
  id uuid primary key default gen_random_uuid(),
  run_date date not null default current_date,
  feed_name text not null,
  api_provider text not null,
  endpoint_called text,
  records_returned integer default 0,
  estimated_cost_cents integer default 0,
  api_calls_made integer default 1,
  response_status text default 'success',
  created_at timestamptz default now()
);

-- Day engine run log
create table if not exists sbo_day_engine_runs (
  id uuid primary key default gen_random_uuid(),
  run_date date not null default current_date,
  run_type text not null,
  trigger_time text not null,
  steps_completed jsonb default '[]',
  steps_failed jsonb default '[]',
  total_records_synced integer default 0,
  total_api_calls integer default 0,
  estimated_cost_cents integer default 0,
  duration_seconds integer,
  status text default 'running',
  started_at timestamptz default now(),
  completed_at timestamptz,
  notes text
);

-- Monthly API budget settings
create table if not exists sbo_api_budget (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  monthly_limit_cents integer not null default 5000,
  current_month_spend_cents integer default 0,
  alert_threshold_pct integer default 80,
  plan_name text,
  plan_details text,
  updated_at timestamptz default now()
);

-- Seed default budget entries
insert into sbo_api_budget (provider, monthly_limit_cents, plan_name, plan_details)
values
  ('the_odds_api', 0, 'Free Tier', '500 requests/month free — $0 cost'),
  ('sportsdata_io', 0, 'Trial/Subscription', 'Subscription based — track manually'),
  ('prizepicks', 0, 'Free', 'Unofficial API — always free')
on conflict (provider) do nothing;
