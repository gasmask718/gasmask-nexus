ALTER TABLE public.sbo_capper_picks
  ADD COLUMN IF NOT EXISTS game_id UUID REFERENCES public.sbo_games(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sbo_capper_picks_game_id
  ON public.sbo_capper_picks (game_id)
  WHERE game_id IS NOT NULL;

COMMENT ON COLUMN public.sbo_capper_picks.game_id IS
  'sbo_games row this pick was graded against. NULL when the game was absent from sbo_games or skipped as an ambiguous doubleheader — grading is never blocked on this column.';