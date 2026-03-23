
ALTER TABLE sbo_parlays ADD COLUMN IF NOT EXISTS game_date date;
ALTER TABLE sbo_parlay_builder ADD COLUMN IF NOT EXISTS game_date date;
