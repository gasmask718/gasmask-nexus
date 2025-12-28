-- Create sportsbook_lines table for uploaded betting lines
CREATE TABLE public.sportsbook_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sport TEXT NOT NULL DEFAULT 'NBA',
  market_type TEXT NOT NULL,
  player_or_team TEXT NOT NULL,
  opponent TEXT,
  line_value NUMERIC,
  over_odds INTEGER,
  under_odds INTEGER,
  sportsbook TEXT,
  game_date DATE NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  uploaded_by UUID REFERENCES auth.users(id),
  matched_player_id UUID,
  matched_team_id UUID,
  is_valid BOOLEAN DEFAULT true,
  validation_notes TEXT
);

-- Add sportsbook_line_id to existing bets_simulated table
ALTER TABLE public.bets_simulated 
ADD COLUMN sportsbook_line_id UUID REFERENCES public.sportsbook_lines(id) ON DELETE SET NULL;

-- Add AI comparison columns to bets_simulated if not exists
ALTER TABLE public.bets_simulated 
ADD COLUMN IF NOT EXISTS ai_projection NUMERIC,
ADD COLUMN IF NOT EXISTS implied_probability NUMERIC,
ADD COLUMN IF NOT EXISTS ai_probability NUMERIC,
ADD COLUMN IF NOT EXISTS edge NUMERIC,
ADD COLUMN IF NOT EXISTS recommendation TEXT;

-- Enable RLS
ALTER TABLE public.sportsbook_lines ENABLE ROW LEVEL SECURITY;

-- RLS policies for sportsbook_lines (admin/owner only)
CREATE POLICY "Admins can manage sportsbook_lines"
ON public.sportsbook_lines
FOR ALL
USING (public.is_admin(auth.uid()) OR public.is_owner(auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_sportsbook_lines_game_date ON public.sportsbook_lines(game_date);
CREATE INDEX idx_sportsbook_lines_sport ON public.sportsbook_lines(sport);
CREATE INDEX idx_bets_simulated_sportsbook_line ON public.bets_simulated(sportsbook_line_id);