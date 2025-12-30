-- Create final_results table as the authoritative source for settled games
CREATE TABLE IF NOT EXISTS public.final_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id TEXT NOT NULL,
  game_date DATE NOT NULL,
  sport TEXT NOT NULL DEFAULT 'NBA',
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  ai_predicted_winner TEXT,
  actual_winner TEXT NOT NULL,
  is_correct BOOLEAN,
  ai_probability NUMERIC(6,4),
  ai_confidence_score NUMERIC(6,4),
  model_version TEXT DEFAULT 'v1',
  prediction_id UUID REFERENCES public.ai_game_predictions(id),
  confirmation_id UUID REFERENCES public.confirmed_game_winners(id),
  settled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  settled_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_final_result_per_game UNIQUE (game_id, model_version)
);

-- Enable RLS
ALTER TABLE public.final_results ENABLE ROW LEVEL SECURITY;

-- RLS policies for final_results
CREATE POLICY "Anyone can view final results"
  ON public.final_results
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert final results"
  ON public.final_results
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update their final results"
  ON public.final_results
  FOR UPDATE
  TO authenticated
  USING (true);

-- Create function to auto-settle when winner is confirmed
CREATE OR REPLACE FUNCTION public.auto_settle_on_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_prediction RECORD;
  v_is_correct BOOLEAN;
BEGIN
  -- Only process if not revoked
  IF NEW.confirmation_revoked = true THEN
    RETURN NEW;
  END IF;

  -- Get the AI prediction for this game
  SELECT * INTO v_prediction
  FROM public.ai_game_predictions
  WHERE game_id = NEW.game_id
  AND sport = NEW.sport
  ORDER BY created_at DESC
  LIMIT 1;

  -- Calculate correctness
  IF v_prediction.id IS NOT NULL THEN
    v_is_correct := (v_prediction.ai_predicted_winner = NEW.confirmed_winner);
  ELSE
    v_is_correct := NULL;
  END IF;

  -- Insert or update final_results
  INSERT INTO public.final_results (
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
    COALESCE(v_prediction.model_version, 'v1'),
    v_prediction.id,
    NEW.id,
    now(),
    NEW.confirmed_by
  )
  ON CONFLICT (game_id, model_version)
  DO UPDATE SET
    actual_winner = EXCLUDED.actual_winner,
    is_correct = EXCLUDED.is_correct,
    home_score = EXCLUDED.home_score,
    away_score = EXCLUDED.away_score,
    confirmation_id = EXCLUDED.confirmation_id,
    settled_at = now(),
    settled_by = EXCLUDED.settled_by;

  -- Also update prediction_evaluations for backward compatibility
  INSERT INTO public.prediction_evaluations (
    game_id,
    game_date,
    sport,
    ai_predicted_winner,
    confirmed_winner,
    ai_result,
    prediction_id,
    confirmation_id,
    evaluated_by,
    is_valid
  ) VALUES (
    NEW.game_id,
    NEW.game_date,
    NEW.sport,
    v_prediction.ai_predicted_winner,
    NEW.confirmed_winner,
    CASE WHEN v_is_correct THEN 'correct' ELSE 'incorrect' END,
    v_prediction.id,
    NEW.id,
    NEW.confirmed_by,
    true
  )
  ON CONFLICT (game_id, game_date, sport) 
  DO UPDATE SET
    ai_predicted_winner = EXCLUDED.ai_predicted_winner,
    confirmed_winner = EXCLUDED.confirmed_winner,
    ai_result = EXCLUDED.ai_result,
    evaluated_at = now(),
    evaluated_by = EXCLUDED.evaluated_by,
    is_valid = true,
    invalidated_at = NULL,
    invalidation_reason = NULL
  WHERE prediction_evaluations.is_valid = false OR prediction_evaluations.ai_result IS DISTINCT FROM EXCLUDED.ai_result;

  RETURN NEW;
END;
$$;

-- Create trigger for automatic settlement
DROP TRIGGER IF EXISTS trigger_auto_settle_on_confirmation ON public.confirmed_game_winners;
CREATE TRIGGER trigger_auto_settle_on_confirmation
  AFTER INSERT OR UPDATE ON public.confirmed_game_winners
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_settle_on_confirmation();

-- Add unique constraint to prediction_evaluations if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_prediction_evaluation_per_game'
  ) THEN
    ALTER TABLE public.prediction_evaluations
    ADD CONSTRAINT unique_prediction_evaluation_per_game UNIQUE (game_id, game_date, sport);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create function to handle revoked confirmations
CREATE OR REPLACE FUNCTION public.handle_revoked_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- When confirmation is revoked, invalidate the final result
  IF NEW.confirmation_revoked = true AND OLD.confirmation_revoked = false THEN
    -- Update final_results to mark as invalidated
    UPDATE public.final_results
    SET is_correct = NULL
    WHERE confirmation_id = NEW.id;

    -- Invalidate prediction evaluations
    UPDATE public.prediction_evaluations
    SET is_valid = false,
        invalidated_at = now(),
        invalidation_reason = COALESCE(NEW.revoke_reason, 'Confirmation revoked')
    WHERE game_id = NEW.game_id
    AND game_date = NEW.game_date;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for handling revoked confirmations
DROP TRIGGER IF EXISTS trigger_handle_revoked_confirmation ON public.confirmed_game_winners;
CREATE TRIGGER trigger_handle_revoked_confirmation
  AFTER UPDATE ON public.confirmed_game_winners
  FOR EACH ROW
  WHEN (NEW.confirmation_revoked = true AND OLD.confirmation_revoked = false)
  EXECUTE FUNCTION public.handle_revoked_confirmation();