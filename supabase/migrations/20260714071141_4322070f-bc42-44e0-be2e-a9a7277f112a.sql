
ALTER TABLE public.sbo_capper_picks
  ADD COLUMN IF NOT EXISTS pnl_units numeric,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_sbo_capper_picks_pending_resolve
  ON public.sbo_capper_picks (sport, game_date)
  WHERE result = 'pending';

ALTER TABLE public.sbo_cappers
  ADD COLUMN IF NOT EXISTS total_wins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_losses integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_pushes integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_sbo_signals_pending_resolve
  ON public.sbo_signals (sport, game_date)
  WHERE result = 'pending';

CREATE INDEX IF NOT EXISTS idx_sbo_prop_picks_pending_resolve
  ON public.sbo_prop_picks (sport, game_date)
  WHERE result = 'pending';
