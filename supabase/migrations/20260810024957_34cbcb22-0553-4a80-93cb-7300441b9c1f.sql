CREATE TABLE IF NOT EXISTS public.sbo_capper_picks_repoint_backup (
  id UUID PRIMARY KEY,
  original_game_date DATE NOT NULL,
  original_unsupported BOOLEAN NOT NULL,
  original_unsupported_reason TEXT,
  repointed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.sbo_capper_picks_repoint_backup TO service_role;

ALTER TABLE public.sbo_capper_picks_repoint_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sbo operators can read repoint backup"
  ON public.sbo_capper_picks_repoint_backup
  FOR SELECT TO authenticated
  USING (public.is_sbo_operator());