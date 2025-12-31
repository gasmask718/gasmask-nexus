-- Drop the overly restrictive unique constraint on game_id alone
-- This allows multiple result types (moneyline, props) for the same game
ALTER TABLE final_results DROP CONSTRAINT IF EXISTS final_results_game_id_key;

-- Drop the model_version based unique constraint as a constraint (not index)
ALTER TABLE final_results DROP CONSTRAINT IF EXISTS unique_final_result_per_game;

-- Create a proper unique constraint for moneyline results (one per game)
CREATE UNIQUE INDEX IF NOT EXISTS idx_final_results_moneyline_unique 
ON final_results (game_id) 
WHERE market_type = 'moneyline';

-- The prop unique index already exists: idx_final_results_prop_unique