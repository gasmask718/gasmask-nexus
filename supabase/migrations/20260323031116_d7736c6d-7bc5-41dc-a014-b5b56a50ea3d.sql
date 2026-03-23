create table if not exists sbo_parlay_builder (
  id uuid primary key default gen_random_uuid(),
  parlay_name text,
  leg_count int,
  variation_number int,
  legs jsonb,
  combined_odds_decimal numeric,
  combined_odds_american text,
  win_probability numeric,
  ev_percentage numeric,
  stake numeric default 0,
  potential_payout numeric,
  profit_if_win numeric,
  ai_analysis text,
  ai_verdict text,
  confidence_score numeric,
  correlation_risk text,
  result text default 'pending',
  created_at timestamptz default now()
);

alter table sbo_parlay_builder enable row level security;

create policy "Allow all access to sbo_parlay_builder"
  on sbo_parlay_builder for all
  using (true)
  with check (true);