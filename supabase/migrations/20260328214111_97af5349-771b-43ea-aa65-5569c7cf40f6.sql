
-- Expand sbo_external_results with team-level game data for moneyline/spread/total resolution
ALTER TABLE public.sbo_external_results
  ADD COLUMN IF NOT EXISTS league text,
  ADD COLUMN IF NOT EXISTS home_team text,
  ADD COLUMN IF NOT EXISTS away_team text,
  ADD COLUMN IF NOT EXISTS home_score integer,
  ADD COLUMN IF NOT EXISTS away_score integer,
  ADD COLUMN IF NOT EXISTS winner text,
  ADD COLUMN IF NOT EXISTS total_score integer,
  ADD COLUMN IF NOT EXISTS spread_result numeric,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb;

-- Index for team-based lookups (moneyline/spread/total)
CREATE INDEX IF NOT EXISTS idx_sbo_external_results_teams
  ON public.sbo_external_results (home_team, away_team, game_date);
