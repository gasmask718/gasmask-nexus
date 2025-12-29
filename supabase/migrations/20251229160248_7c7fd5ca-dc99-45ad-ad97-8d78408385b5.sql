-- Add score and winner columns to nba_games_today for settlement
ALTER TABLE public.nba_games_today 
ADD COLUMN IF NOT EXISTS home_score integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS away_score integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS winner text DEFAULT NULL;

-- Add settled_at column to pick_entries for locking
ALTER TABLE public.pick_entries 
ADD COLUMN IF NOT EXISTS settled_at timestamp with time zone DEFAULT NULL;

-- Add index for efficient settlement queries
CREATE INDEX IF NOT EXISTS idx_pick_entries_settlement 
ON public.pick_entries (market, sport, status, date) 
WHERE status = 'open';

-- Add index for game matching
CREATE INDEX IF NOT EXISTS idx_nba_games_today_status 
ON public.nba_games_today (status, game_date) 
WHERE status = 'Final';