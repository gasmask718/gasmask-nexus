-- Drop all auto-settle triggers and functions with CASCADE
DROP TRIGGER IF EXISTS trigger_auto_settle_results ON confirmed_game_winners;
DROP FUNCTION IF EXISTS auto_settle_to_results() CASCADE;