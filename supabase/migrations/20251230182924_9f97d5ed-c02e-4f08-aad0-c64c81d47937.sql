-- 1) Add validation and source tracking columns to final_results
ALTER TABLE public.final_results 
ADD COLUMN IF NOT EXISTS is_valid BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS invalid_reason TEXT,
ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS prediction_source TEXT DEFAULT 'ai',
ADD COLUMN IF NOT EXISTS settlement_source TEXT DEFAULT 'automatic',
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- 2) Lock all existing rows (they were created via automatic trigger)
UPDATE public.final_results 
SET locked_at = settled_at,
    prediction_source = 'ai',
    settlement_source = 'automatic',
    is_valid = true
WHERE locked_at IS NULL;

-- 3) Create trigger to enforce immutability on locked rows
CREATE OR REPLACE FUNCTION public.enforce_final_results_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- If row is locked, prevent changes to core fields
  IF OLD.locked_at IS NOT NULL THEN
    IF NEW.ai_predicted_winner IS DISTINCT FROM OLD.ai_predicted_winner OR
       NEW.actual_winner IS DISTINCT FROM OLD.actual_winner OR
       NEW.is_correct IS DISTINCT FROM OLD.is_correct OR
       NEW.ai_probability IS DISTINCT FROM OLD.ai_probability OR
       NEW.ai_confidence_score IS DISTINCT FROM OLD.ai_confidence_score THEN
      RAISE EXCEPTION 'Cannot modify locked final_results row. Row was locked at %', OLD.locked_at;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_final_results_lock ON public.final_results;
CREATE TRIGGER enforce_final_results_lock
  BEFORE UPDATE ON public.final_results
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_final_results_immutability();

-- 4) Create trigger to block manual inserts (must be automatic)
CREATE OR REPLACE FUNCTION public.validate_final_results_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure prediction_source is 'ai' and settlement_source is 'automatic'
  IF NEW.prediction_source IS NULL OR NEW.prediction_source != 'ai' THEN
    RAISE EXCEPTION 'final_results only accepts prediction_source = ai';
  END IF;
  
  IF NEW.settlement_source IS NULL OR NEW.settlement_source != 'automatic' THEN
    RAISE EXCEPTION 'final_results only accepts settlement_source = automatic';
  END IF;
  
  -- Auto-lock new rows
  NEW.locked_at := COALESCE(NEW.locked_at, NOW());
  NEW.is_valid := true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS validate_final_results_source ON public.final_results;
CREATE TRIGGER validate_final_results_source
  BEFORE INSERT ON public.final_results
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_final_results_insert();

-- 5) Update the auto_settle_to_final_results function to include source fields
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
  
  -- Upsert into final_results with source tracking
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
    settled_by,
    prediction_source,
    settlement_source,
    is_valid,
    locked_at
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
    NEW.confirmed_by,
    'ai',
    'automatic',
    true,
    NOW()
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6) Create index for analytics queries filtering by is_valid
CREATE INDEX IF NOT EXISTS idx_final_results_valid ON public.final_results(is_valid) WHERE is_valid = true;