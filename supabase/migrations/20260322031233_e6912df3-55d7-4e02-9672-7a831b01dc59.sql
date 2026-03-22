
create table if not exists sbo_run_log (
  id uuid primary key default gen_random_uuid(),
  run_type text not null default 'full',
  started_at timestamptz default now(),
  completed_at timestamptz,
  duration_ms integer,
  games_fetched integer default 0,
  games_predicted integer default 0,
  props_analyzed integer default 0,
  parlay_built boolean default false,
  status text default 'running',
  error_message text,
  created_at timestamptz default now()
);
