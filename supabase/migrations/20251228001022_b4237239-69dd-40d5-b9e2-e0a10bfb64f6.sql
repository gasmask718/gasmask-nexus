-- Add calibration columns to market_lines for probability calibration
ALTER TABLE public.market_lines
ADD COLUMN IF NOT EXISTS player_recent_avg numeric,
ADD COLUMN IF NOT EXISTS player_recent_std numeric,
ADD COLUMN IF NOT EXISTS player_season_avg numeric,
ADD COLUMN IF NOT EXISTS minutes_trend text CHECK (minutes_trend IN ('up', 'flat', 'down')),
ADD COLUMN IF NOT EXISTS opponent_def_tier text CHECK (opponent_def_tier IN ('low', 'med', 'high')),
ADD COLUMN IF NOT EXISTS pace_tier text CHECK (pace_tier IN ('slow', 'avg', 'fast')),
ADD COLUMN IF NOT EXISTS home_game boolean;

-- Add calibration factors column to bets_simulated for tracking what moved probability
ALTER TABLE public.bets_simulated
ADD COLUMN IF NOT EXISTS calibration_factors jsonb,
ADD COLUMN IF NOT EXISTS data_completeness integer;

-- Add comment explaining the columns
COMMENT ON COLUMN public.market_lines.player_recent_avg IS 'Player recent game average for the stat';
COMMENT ON COLUMN public.market_lines.player_recent_std IS 'Standard deviation of recent games';
COMMENT ON COLUMN public.market_lines.player_season_avg IS 'Season average for the stat';
COMMENT ON COLUMN public.market_lines.minutes_trend IS 'Recent minutes trend: up/flat/down';
COMMENT ON COLUMN public.market_lines.opponent_def_tier IS 'Opponent defense tier: low/med/high';
COMMENT ON COLUMN public.market_lines.pace_tier IS 'Expected game pace: slow/avg/fast';
COMMENT ON COLUMN public.market_lines.home_game IS 'Is this a home game for the player';
COMMENT ON COLUMN public.bets_simulated.calibration_factors IS 'JSON object of factors that moved probability';
COMMENT ON COLUMN public.bets_simulated.data_completeness IS 'Percentage of optional inputs provided (0-100)';