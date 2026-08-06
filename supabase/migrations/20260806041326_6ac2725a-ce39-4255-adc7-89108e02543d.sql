DROP INDEX IF EXISTS idx_sbo_capper_picks_dedup;

CREATE UNIQUE INDEX idx_sbo_capper_picks_natural_key
ON public.sbo_capper_picks (
  capper_id,
  sport,
  (game_date::date),
  COALESCE(team, ''),
  COALESCE(player_name, ''),
  bet_type,
  COALESCE(direction, '')
);