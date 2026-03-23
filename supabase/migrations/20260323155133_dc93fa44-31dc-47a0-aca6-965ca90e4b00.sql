-- Add game_date column to sbo_player_props
ALTER TABLE public.sbo_player_props ADD COLUMN IF NOT EXISTS game_date date;

-- Backfill game_date from linked sbo_games
UPDATE public.sbo_player_props pp
SET game_date = g.game_date::date
FROM public.sbo_games g
WHERE g.id = pp.game_id
AND pp.game_date IS NULL;

-- Fallback: for props without game_id, use created_at in ET
UPDATE public.sbo_player_props
SET game_date = (created_at AT TIME ZONE 'America/New_York')::date
WHERE game_date IS NULL;