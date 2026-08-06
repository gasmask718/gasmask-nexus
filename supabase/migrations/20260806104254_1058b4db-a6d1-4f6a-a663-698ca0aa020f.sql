ALTER TABLE public.props_master
ADD COLUMN IF NOT EXISTS stats_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_props_master_stats_sweep
ON public.props_master (stats_checked_at)
WHERE season_avg IS NULL;