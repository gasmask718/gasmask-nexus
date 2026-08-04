DROP INDEX IF EXISTS public.idx_sbo_capper_picks_dedup;

CREATE UNIQUE INDEX idx_sbo_capper_picks_dedup
  ON public.sbo_capper_picks (
    capper_id,
    coalesce(prop_type, ''),
    coalesce(line, -9999),
    coalesce(game_date, '1900-01-01'::date),
    coalesce(player_name, ''),
    coalesce(direction, '')
  )
  WHERE created_at >= timestamptz '2026-08-04 12:00:00+00';