-- Create table for confirmed game winners (manual truth confirmation)
CREATE TABLE public.confirmed_game_winners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id TEXT NOT NULL UNIQUE,
  game_date DATE NOT NULL,
  sport TEXT NOT NULL DEFAULT 'NBA',
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  confirmed_winner TEXT NOT NULL,
  confirmation_source TEXT NOT NULL DEFAULT 'manual_admin',
  confirmed_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  previous_winner TEXT,
  override_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.confirmed_game_winners ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read confirmed winners (for learning/analytics)
CREATE POLICY "Anyone can read confirmed winners"
ON public.confirmed_game_winners
FOR SELECT
USING (true);

-- Only authenticated users can insert confirmations
CREATE POLICY "Authenticated users can insert confirmed winners"
ON public.confirmed_game_winners
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Only authenticated users can update their confirmations (for overrides)
CREATE POLICY "Authenticated users can update confirmed winners"
ON public.confirmed_game_winners
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Add index for faster lookups
CREATE INDEX idx_confirmed_game_winners_game_date ON public.confirmed_game_winners(game_date);
CREATE INDEX idx_confirmed_game_winners_game_id ON public.confirmed_game_winners(game_id);
CREATE INDEX idx_confirmed_game_winners_sport ON public.confirmed_game_winners(sport);

-- Trigger for updated_at
CREATE TRIGGER update_confirmed_game_winners_updated_at
BEFORE UPDATE ON public.confirmed_game_winners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();