-- Add locked_at column to ai_game_predictions to enforce immutability
ALTER TABLE public.ai_game_predictions
ADD COLUMN locked_at TIMESTAMP WITH TIME ZONE;

-- Add unique constraint to prevent duplicate predictions for same game/model
ALTER TABLE public.ai_game_predictions
ADD CONSTRAINT ai_game_predictions_game_model_unique UNIQUE (game_id, model_version);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_game_predictions_game_id ON public.ai_game_predictions(game_id);
CREATE INDEX IF NOT EXISTS idx_ai_game_predictions_game_date ON public.ai_game_predictions(game_date);

-- Create trigger to auto-lock predictions when created
CREATE OR REPLACE FUNCTION public.lock_ai_prediction()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-lock new predictions immediately
  IF NEW.locked_at IS NULL THEN
    NEW.locked_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_lock_ai_prediction
BEFORE INSERT ON public.ai_game_predictions
FOR EACH ROW EXECUTE FUNCTION public.lock_ai_prediction();

-- Create trigger to prevent modifications to locked predictions
CREATE OR REPLACE FUNCTION public.enforce_ai_prediction_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- If prediction is locked, prevent changes to core fields
  IF OLD.locked_at IS NOT NULL THEN
    IF NEW.ai_predicted_winner IS DISTINCT FROM OLD.ai_predicted_winner OR
       NEW.ai_predicted_probability IS DISTINCT FROM OLD.ai_predicted_probability OR
       NEW.ai_confidence_score IS DISTINCT FROM OLD.ai_confidence_score THEN
      RAISE EXCEPTION 'Cannot modify locked AI prediction. Prediction was locked at %', OLD.locked_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_enforce_ai_prediction_immutability
BEFORE UPDATE ON public.ai_game_predictions
FOR EACH ROW EXECUTE FUNCTION public.enforce_ai_prediction_immutability();