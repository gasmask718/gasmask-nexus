-- ITEM 1: non-destructive column for date provenance
ALTER TABLE public.sbo_capper_picks
  ADD COLUMN IF NOT EXISTS game_date_source TEXT;

COMMENT ON COLUMN public.sbo_capper_picks.game_date_source IS
  'NULL = game_date came from the message. ''inferred_post_date'' = intake fell back to the Telegram post date in ET (Phase 6 Item 1).';

-- ITEM 2: close the NULL-date uniqueness bypass for ACTIVE rows only.
-- The pre-existing idx_sbo_capper_picks_natural_key is LEFT IN PLACE (non-destructive);
-- this partial index adds the COALESCE(game_date) guard scoped to unsupported = false.
-- Verified safe: all 19 existing NULL-date rows are unsupported = true, so none are covered.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sbo_capper_picks_natural_key_active
  ON public.sbo_capper_picks (
    capper_id,
    sport,
    COALESCE(game_date, DATE '1900-01-01'),
    COALESCE(team, ''),
    COALESCE(player_name, ''),
    bet_type,
    COALESCE(direction, '')
  )
  WHERE unsupported = false;

-- Phase 6 rollback ledger (private: no GRANTs to anon/authenticated, service_role only)
CREATE TABLE IF NOT EXISTS public.sbo_capper_picks_phase6_backup (
  id UUID PRIMARY KEY,
  phase TEXT NOT NULL,
  prev_sport TEXT,
  prev_team TEXT,
  prev_unsupported BOOLEAN,
  prev_unsupported_reason TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.sbo_capper_picks_phase6_backup TO service_role;

ALTER TABLE public.sbo_capper_picks_phase6_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "phase6_backup_service_role_only"
  ON public.sbo_capper_picks_phase6_backup
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);