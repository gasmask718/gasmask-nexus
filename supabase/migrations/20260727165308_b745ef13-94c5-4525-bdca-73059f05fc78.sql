ALTER TABLE public.sbo_capper_picks
  ADD COLUMN unsupported boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sbo_capper_picks.unsupported IS
  'True when the pick cannot be graded by our current result source (e.g. player props / parlays that ESPN scoreboards do not expose). Excluded from grading attempts and pending counts. Does NOT affect win/loss/push rollups since result stays pending.';

CREATE INDEX IF NOT EXISTS sbo_capper_picks_pending_gradeable_idx
  ON public.sbo_capper_picks (sport, game_date)
  WHERE result = 'pending' AND unsupported = false;