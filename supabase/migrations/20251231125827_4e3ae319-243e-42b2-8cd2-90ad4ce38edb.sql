-- Update the validation trigger to allow games without AI predictions
-- Settlement is authoritative - games should be recorded even without AI picks
CREATE OR REPLACE FUNCTION validate_final_results_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Settlement source must be 'automatic' - no manual inserts
  IF NEW.settlement_source IS NULL OR NEW.settlement_source != 'automatic' THEN
    RAISE EXCEPTION 'final_results only accepts settlement_source = automatic';
  END IF;
  
  -- Prediction source: if AI prediction exists, must be 'ai'; otherwise allow NULL
  IF NEW.ai_predicted_winner IS NOT NULL AND (NEW.prediction_source IS NULL OR NEW.prediction_source != 'ai') THEN
    RAISE EXCEPTION 'When AI prediction exists, prediction_source must be ai';
  END IF;
  
  -- Auto-lock new rows
  NEW.locked_at := COALESCE(NEW.locked_at, NOW());
  NEW.is_valid := true;
  
  -- Set market_type default if not specified
  IF NEW.market_type IS NULL THEN
    NEW.market_type := 'moneyline';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;