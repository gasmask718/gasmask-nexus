ALTER TABLE public.sbo_capper_picks
  ADD COLUMN IF NOT EXISTS scored_at timestamptz,
  ADD COLUMN IF NOT EXISTS score_frozen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS score_version text;

CREATE INDEX IF NOT EXISTS idx_sbo_capper_picks_scoring
  ON public.sbo_capper_picks (game_date DESC) WHERE score_frozen = false;