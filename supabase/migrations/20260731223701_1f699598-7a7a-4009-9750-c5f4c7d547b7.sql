CREATE UNIQUE INDEX IF NOT EXISTS sbo_signals_game_identity_uidx
  ON public.sbo_signals (sport, game_date, home_team, away_team, pick_type);