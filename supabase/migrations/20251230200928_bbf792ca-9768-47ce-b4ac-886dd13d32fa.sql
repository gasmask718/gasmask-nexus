
-- Create moneyline_results table (read-only after settlement)
CREATE TABLE IF NOT EXISTS public.moneyline_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL UNIQUE,
  game_date DATE NOT NULL,
  sport TEXT NOT NULL DEFAULT 'NBA',
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  ai_predicted_winner TEXT,
  actual_winner TEXT NOT NULL,
  result TEXT CHECK (result IN ('W', 'L')),
  ai_probability NUMERIC(5,4),
  confidence_score NUMERIC(5,4),
  model_version TEXT DEFAULT 'v1',
  prediction_id UUID,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create prop_results table (read-only after settlement)
CREATE TABLE IF NOT EXISTS public.prop_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL,
  game_date DATE NOT NULL,
  sport TEXT NOT NULL DEFAULT 'NBA',
  player_id TEXT,
  player_name TEXT NOT NULL,
  team TEXT,
  opponent TEXT,
  stat_type TEXT NOT NULL,
  line_value NUMERIC(10,2) NOT NULL,
  final_stat_value NUMERIC(10,2),
  ai_predicted_side TEXT CHECK (ai_predicted_side IN ('MORE', 'LESS', 'OVER', 'UNDER')),
  result TEXT CHECK (result IN ('W', 'L', 'Push')),
  confidence_score NUMERIC(5,4),
  model_version TEXT DEFAULT 'v1',
  dnp BOOLEAN DEFAULT false,
  stat_source TEXT,
  pick_entry_id UUID,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, player_id, stat_type, model_version)
);

-- Enable RLS
ALTER TABLE public.moneyline_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prop_results ENABLE ROW LEVEL SECURITY;

-- Read-only policies (no INSERT/UPDATE/DELETE from client)
CREATE POLICY "Moneyline results are viewable by everyone"
ON public.moneyline_results FOR SELECT USING (true);

CREATE POLICY "Prop results are viewable by everyone"
ON public.prop_results FOR SELECT USING (true);

-- Indexes for performance
CREATE INDEX idx_moneyline_results_date ON public.moneyline_results(game_date);
CREATE INDEX idx_moneyline_results_sport ON public.moneyline_results(sport);
CREATE INDEX idx_prop_results_date ON public.prop_results(game_date);
CREATE INDEX idx_prop_results_player ON public.prop_results(player_id);
CREATE INDEX idx_prop_results_sport ON public.prop_results(sport);

-- Trigger to enforce immutability on moneyline_results
CREATE OR REPLACE FUNCTION public.enforce_moneyline_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot modify locked moneyline result';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_moneyline_lock
BEFORE UPDATE ON public.moneyline_results
FOR EACH ROW EXECUTE FUNCTION public.enforce_moneyline_immutability();

-- Trigger to enforce immutability on prop_results
CREATE OR REPLACE FUNCTION public.enforce_prop_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot modify locked prop result';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_prop_lock
BEFORE UPDATE ON public.prop_results
FOR EACH ROW EXECUTE FUNCTION public.enforce_prop_immutability();

-- Update auto_settle function to write to new tables
CREATE OR REPLACE FUNCTION public.auto_settle_to_results()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prediction RECORD;
  v_is_correct BOOLEAN;
  v_result TEXT;
BEGIN
  IF NEW.confirmation_revoked = true THEN
    RETURN NEW;
  END IF;
  
  SELECT * INTO v_prediction
  FROM ai_game_predictions
  WHERE game_id = NEW.game_id AND sport = NEW.sport
  LIMIT 1;
  
  IF v_prediction.ai_predicted_winner IS NOT NULL THEN
    v_is_correct := (v_prediction.ai_predicted_winner = NEW.confirmed_winner);
    v_result := CASE WHEN v_is_correct THEN 'W' ELSE 'L' END;
  ELSE
    v_is_correct := NULL;
    v_result := NULL;
  END IF;
  
  -- Write to moneyline_results
  INSERT INTO moneyline_results (
    game_id, game_date, sport, home_team, away_team,
    home_score, away_score, ai_predicted_winner, actual_winner,
    result, ai_probability, confidence_score, model_version,
    prediction_id, settled_at, locked_at
  ) VALUES (
    NEW.game_id, NEW.game_date, NEW.sport, NEW.home_team, NEW.away_team,
    NEW.home_score, NEW.away_score, v_prediction.ai_predicted_winner, NEW.confirmed_winner,
    v_result, v_prediction.ai_predicted_probability, v_prediction.ai_confidence_score,
    COALESCE(v_prediction.model_version, 'v1'), v_prediction.id, NOW(), NOW()
  )
  ON CONFLICT (game_id) DO UPDATE SET
    home_score = EXCLUDED.home_score,
    away_score = EXCLUDED.away_score,
    actual_winner = EXCLUDED.actual_winner,
    result = EXCLUDED.result,
    settled_at = NOW();
  
  -- Also keep final_results updated for backward compatibility
  INSERT INTO final_results (
    game_id, game_date, sport, home_team, away_team,
    home_score, away_score, ai_predicted_winner, actual_winner,
    is_correct, ai_probability, ai_confidence_score, model_version,
    prediction_id, confirmation_id, settled_at, settled_by,
    prediction_source, settlement_source, is_valid, locked_at, market_type
  ) VALUES (
    NEW.game_id, NEW.game_date, NEW.sport, NEW.home_team, NEW.away_team,
    NEW.home_score, NEW.away_score, v_prediction.ai_predicted_winner, NEW.confirmed_winner,
    v_is_correct, v_prediction.ai_predicted_probability, v_prediction.ai_confidence_score,
    COALESCE(v_prediction.model_version, 'v1'), v_prediction.id, NEW.id, NOW(), NEW.confirmed_by,
    'ai', 'automatic', true, NOW(), 'moneyline'
  )
  ON CONFLICT (game_id) DO UPDATE SET
    home_score = EXCLUDED.home_score,
    away_score = EXCLUDED.away_score,
    actual_winner = EXCLUDED.actual_winner,
    is_correct = EXCLUDED.is_correct,
    settled_at = NOW();
  
  RETURN NEW;
END;
$$;

-- Drop old trigger and create new one
DROP TRIGGER IF EXISTS trigger_auto_settle_final_results ON public.confirmed_game_winners;
CREATE TRIGGER trigger_auto_settle_results
AFTER INSERT OR UPDATE ON public.confirmed_game_winners
FOR EACH ROW EXECUTE FUNCTION public.auto_settle_to_results();

-- Backfill moneyline_results from existing data
INSERT INTO moneyline_results (
  game_id, game_date, sport, home_team, away_team,
  home_score, away_score, ai_predicted_winner, actual_winner,
  result, ai_probability, confidence_score, model_version,
  prediction_id, settled_at, locked_at
)
SELECT 
  fr.game_id, fr.game_date, fr.sport, fr.home_team, fr.away_team,
  fr.home_score, fr.away_score, fr.ai_predicted_winner, fr.actual_winner,
  CASE WHEN fr.is_correct = true THEN 'W' WHEN fr.is_correct = false THEN 'L' ELSE NULL END,
  fr.ai_probability, fr.ai_confidence_score, fr.model_version,
  fr.prediction_id, fr.settled_at, fr.locked_at
FROM final_results fr
WHERE fr.market_type = 'moneyline' OR fr.market_type IS NULL
ON CONFLICT (game_id) DO NOTHING;
