-- Create AI predictions table for storing pre-game predictions
CREATE TABLE IF NOT EXISTS public.ai_game_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id TEXT NOT NULL,
  game_date DATE NOT NULL,
  sport TEXT NOT NULL DEFAULT 'NBA',
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  ai_predicted_winner TEXT NOT NULL,
  ai_predicted_probability NUMERIC(5,4),
  ai_confidence_score NUMERIC(5,4),
  model_version TEXT DEFAULT 'v1',
  prediction_source TEXT DEFAULT 'ai',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(game_id, game_date)
);

-- Create prediction evaluations table for storing comparison results
CREATE TABLE IF NOT EXISTS public.prediction_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id TEXT NOT NULL,
  game_date DATE NOT NULL,
  sport TEXT NOT NULL DEFAULT 'NBA',
  ai_predicted_winner TEXT NOT NULL,
  confirmed_winner TEXT NOT NULL,
  ai_result TEXT NOT NULL CHECK (ai_result IN ('correct', 'incorrect')),
  prediction_id UUID REFERENCES public.ai_game_predictions(id),
  confirmation_id UUID REFERENCES public.confirmed_game_winners(id),
  evaluated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  evaluated_by UUID REFERENCES auth.users(id),
  notes TEXT,
  UNIQUE(game_id, game_date)
);

-- Enable RLS
ALTER TABLE public.ai_game_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_evaluations ENABLE ROW LEVEL SECURITY;

-- Policies for ai_game_predictions
CREATE POLICY "Anyone can view ai predictions" 
  ON public.ai_game_predictions 
  FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can insert predictions" 
  ON public.ai_game_predictions 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update predictions" 
  ON public.ai_game_predictions 
  FOR UPDATE 
  USING (true);

-- Policies for prediction_evaluations
CREATE POLICY "Anyone can view evaluations" 
  ON public.prediction_evaluations 
  FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can insert evaluations" 
  ON public.prediction_evaluations 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update evaluations" 
  ON public.prediction_evaluations 
  FOR UPDATE 
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_predictions_game_date ON public.ai_game_predictions(game_date);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_game_id ON public.ai_game_predictions(game_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_game_date ON public.prediction_evaluations(game_date);
CREATE INDEX IF NOT EXISTS idx_evaluations_result ON public.prediction_evaluations(ai_result);