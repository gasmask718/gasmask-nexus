
CREATE TABLE IF NOT EXISTS public.sbo_backfill_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport text NOT NULL DEFAULT 'NBA',
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_dates int NOT NULL DEFAULT 0,
  total_games int NOT NULL DEFAULT 0,
  total_player_stats int NOT NULL DEFAULT 0,
  total_picks_found int NOT NULL DEFAULT 0,
  resolved_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  unmatched_count int NOT NULL DEFAULT 0,
  wins int NOT NULL DEFAULT 0,
  losses int NOT NULL DEFAULT 0,
  pushes int NOT NULL DEFAULT 0,
  roi_summary numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  errors jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.sbo_backfill_log ENABLE ROW LEVEL SECURITY;
