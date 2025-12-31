-- Drop the old auto_settle trigger that has wrong conflict clause
DROP TRIGGER IF EXISTS trigger_auto_settle_on_confirmation ON confirmed_game_winners;
DROP FUNCTION IF EXISTS auto_settle_on_confirmation();