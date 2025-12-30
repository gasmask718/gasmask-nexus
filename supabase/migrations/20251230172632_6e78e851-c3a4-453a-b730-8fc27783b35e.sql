-- Create trigger function to auto-populate final_results on confirmation
CREATE OR REPLACE FUNCTION public.auto_settle_to_final_results()
RETURNS TRIGGER AS $$
DECLARE
  v_prediction RECORD;
  v_is_correct BOOLEAN;
BEGIN
  -- Only process if not revoked
  IF NEW.confirmation_revoked = true THEN
    RETURN NEW;
  END IF;
  
  -- Find the AI prediction for this game
  SELECT * INTO v_prediction
  FROM ai_game_predictions
  WHERE game_id = NEW.game_id 
    AND sport = NEW.sport
  LIMIT 1;
  
  -- Calculate if prediction was correct
  IF v_prediction.ai_predicted_winner IS NOT NULL THEN
    v_is_correct := (v_prediction.ai_predicted_winner = NEW.confirmed_winner);
  ELSE
    v_is_correct := NULL;
  END IF;
  
  -- Upsert into final_results
  INSERT INTO final_results (
    game_id,
    game_date,
    sport,
    home_team,
    away_team,
    home_score,
    away_score,
    ai_predicted_winner,
    actual_winner,
    is_correct,
    ai_probability,
    ai_confidence_score,
    model_version,
    prediction_id,
    confirmation_id,
    settled_at,
    settled_by
  ) VALUES (
    NEW.game_id,
    NEW.game_date,
    NEW.sport,
    NEW.home_team,
    NEW.away_team,
    NEW.home_score,
    NEW.away_score,
    v_prediction.ai_predicted_winner,
    NEW.confirmed_winner,
    v_is_correct,
    v_prediction.ai_predicted_probability,
    v_prediction.ai_confidence_score,
    v_prediction.model_version,
    v_prediction.id,
    NEW.id,
    NOW(),
    NEW.confirmed_by
  )
  ON CONFLICT (game_id) DO UPDATE SET
    home_score = EXCLUDED.home_score,
    away_score = EXCLUDED.away_score,
    actual_winner = EXCLUDED.actual_winner,
    is_correct = EXCLUDED.is_correct,
    settled_at = EXCLUDED.settled_at,
    settled_by = EXCLUDED.settled_by;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on confirmed_game_winners
DROP TRIGGER IF EXISTS trigger_auto_settle_final_results ON confirmed_game_winners;
CREATE TRIGGER trigger_auto_settle_final_results
  AFTER INSERT OR UPDATE ON confirmed_game_winners
  FOR EACH ROW
  EXECUTE FUNCTION auto_settle_to_final_results();

-- Add unique constraint on game_id for upsert
ALTER TABLE final_results DROP CONSTRAINT IF EXISTS final_results_game_id_key;
ALTER TABLE final_results ADD CONSTRAINT final_results_game_id_key UNIQUE (game_id);

-- Backfill function to populate final_results from existing confirmed games
CREATE OR REPLACE FUNCTION public.backfill_final_results()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_confirmation RECORD;
  v_prediction RECORD;
  v_is_correct BOOLEAN;
BEGIN
  FOR v_confirmation IN 
    SELECT * FROM confirmed_game_winners 
    WHERE confirmation_revoked = false
    ORDER BY game_date
  LOOP
    -- Find the AI prediction
    SELECT * INTO v_prediction
    FROM ai_game_predictions
    WHERE game_id = v_confirmation.game_id 
      AND sport = v_confirmation.sport
    LIMIT 1;
    
    -- Calculate correctness
    IF v_prediction.ai_predicted_winner IS NOT NULL THEN
      v_is_correct := (v_prediction.ai_predicted_winner = v_confirmation.confirmed_winner);
    ELSE
      v_is_correct := NULL;
    END IF;
    
    -- Upsert into final_results
    INSERT INTO final_results (
      game_id,
      game_date,
      sport,
      home_team,
      away_team,
      home_score,
      away_score,
      ai_predicted_winner,
      actual_winner,
      is_correct,
      ai_probability,
      ai_confidence_score,
      model_version,
      prediction_id,
      confirmation_id,
      settled_at,
      settled_by
    ) VALUES (
      v_confirmation.game_id,
      v_confirmation.game_date,
      v_confirmation.sport,
      v_confirmation.home_team,
      v_confirmation.away_team,
      v_confirmation.home_score,
      v_confirmation.away_score,
      v_prediction.ai_predicted_winner,
      v_confirmation.confirmed_winner,
      v_is_correct,
      v_prediction.ai_predicted_probability,
      v_prediction.ai_confidence_score,
      v_prediction.model_version,
      v_prediction.id,
      v_confirmation.id,
      v_confirmation.confirmed_at,
      v_confirmation.confirmed_by
    )
    ON CONFLICT (game_id) DO UPDATE SET
      home_score = EXCLUDED.home_score,
      away_score = EXCLUDED.away_score,
      actual_winner = EXCLUDED.actual_winner,
      is_correct = EXCLUDED.is_correct,
      ai_predicted_winner = COALESCE(final_results.ai_predicted_winner, EXCLUDED.ai_predicted_winner),
      ai_probability = COALESCE(final_results.ai_probability, EXCLUDED.ai_probability),
      ai_confidence_score = COALESCE(final_results.ai_confidence_score, EXCLUDED.ai_confidence_score),
      model_version = COALESCE(final_results.model_version, EXCLUDED.model_version),
      prediction_id = COALESCE(final_results.prediction_id, EXCLUDED.prediction_id);
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;