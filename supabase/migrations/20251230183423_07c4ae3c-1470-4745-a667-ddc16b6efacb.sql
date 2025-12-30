-- Add prop-specific columns to final_results for player prop settlement
ALTER TABLE public.final_results
ADD COLUMN IF NOT EXISTS market_type TEXT DEFAULT 'moneyline',
ADD COLUMN IF NOT EXISTS stat_type TEXT,
ADD COLUMN IF NOT EXISTS line_value NUMERIC,
ADD COLUMN IF NOT EXISTS final_stat_value NUMERIC,
ADD COLUMN IF NOT EXISTS stat_source TEXT,
ADD COLUMN IF NOT EXISTS player_id TEXT,
ADD COLUMN IF NOT EXISTS player_name TEXT,
ADD COLUMN IF NOT EXISTS team TEXT,
ADD COLUMN IF NOT EXISTS opponent TEXT,
ADD COLUMN IF NOT EXISTS side TEXT,
ADD COLUMN IF NOT EXISTS dnp BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pick_entry_id UUID;

-- Create unique constraint for prop entries (game_id + player_id + stat_type + model_version)
CREATE UNIQUE INDEX IF NOT EXISTS idx_final_results_prop_unique 
ON public.final_results(game_id, player_id, stat_type, model_version) 
WHERE market_type = 'player_prop';

-- Update the insert validation trigger to allow prop data
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
  
  -- Set market_type default if not specified
  IF NEW.market_type IS NULL THEN
    NEW.market_type := 'moneyline';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update immutability trigger to also protect prop fields
CREATE OR REPLACE FUNCTION public.enforce_final_results_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- If row is locked, prevent changes to core fields
  IF OLD.locked_at IS NOT NULL THEN
    IF NEW.ai_predicted_winner IS DISTINCT FROM OLD.ai_predicted_winner OR
       NEW.actual_winner IS DISTINCT FROM OLD.actual_winner OR
       NEW.is_correct IS DISTINCT FROM OLD.is_correct OR
       NEW.ai_probability IS DISTINCT FROM OLD.ai_probability OR
       NEW.ai_confidence_score IS DISTINCT FROM OLD.ai_confidence_score OR
       NEW.final_stat_value IS DISTINCT FROM OLD.final_stat_value OR
       NEW.side IS DISTINCT FROM OLD.side THEN
      RAISE EXCEPTION 'Cannot modify locked final_results row. Row was locked at %', OLD.locked_at;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;