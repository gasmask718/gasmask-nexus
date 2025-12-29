-- Create table for storing final box score stats from completed games
CREATE TABLE IF NOT EXISTS public.nba_player_box_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id TEXT NOT NULL,
  game_date DATE NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  team TEXT NOT NULL,
  opponent TEXT NOT NULL,
  -- Final box score stats (these are the ONLY source for prop settlement)
  points INTEGER NOT NULL DEFAULT 0,
  rebounds INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  three_pointers_made INTEGER NOT NULL DEFAULT 0,
  steals INTEGER NOT NULL DEFAULT 0,
  blocks INTEGER NOT NULL DEFAULT 0,
  turnovers INTEGER NOT NULL DEFAULT 0,
  minutes INTEGER NOT NULL DEFAULT 0,
  -- Computed stats
  pra INTEGER GENERATED ALWAYS AS (points + rebounds + assists) STORED,
  -- DNP tracking
  dnp BOOLEAN NOT NULL DEFAULT FALSE,
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Unique constraint per player per game
  UNIQUE(game_id, player_id)
);

-- Enable RLS
ALTER TABLE public.nba_player_box_scores ENABLE ROW LEVEL SECURITY;

-- Allow public read access for analytics
CREATE POLICY "Public read access for box scores"
  ON public.nba_player_box_scores
  FOR SELECT
  USING (true);

-- Allow service role to insert/update
CREATE POLICY "Service role can manage box scores"
  ON public.nba_player_box_scores
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create indexes for fast lookups
CREATE INDEX idx_box_scores_game_date ON public.nba_player_box_scores(game_date);
CREATE INDEX idx_box_scores_player_id ON public.nba_player_box_scores(player_id);
CREATE INDEX idx_box_scores_player_name ON public.nba_player_box_scores(player_name);
CREATE INDEX idx_box_scores_game_id ON public.nba_player_box_scores(game_id);

-- Create prop settlement audit log table
CREATE TABLE IF NOT EXISTS public.prop_settlement_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID NOT NULL,
  user_id UUID,
  -- Prop details
  player_name TEXT NOT NULL,
  stat_type TEXT NOT NULL,
  line_value NUMERIC NOT NULL,
  side TEXT NOT NULL, -- MORE or LESS
  -- Settlement details
  final_stat_value NUMERIC NOT NULL,
  comparison_result TEXT NOT NULL, -- 'OVER' or 'UNDER' or 'PUSH'
  result TEXT NOT NULL, -- 'W' or 'L' or 'Push'
  -- Data source verification
  box_score_id UUID REFERENCES public.nba_player_box_scores(id),
  game_id TEXT,
  game_date DATE,
  -- DNP handling
  dnp BOOLEAN NOT NULL DEFAULT FALSE,
  minutes_played INTEGER,
  -- Audit metadata
  settled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  settled_by TEXT DEFAULT 'system',
  settlement_source TEXT DEFAULT 'box_score', -- 'box_score', 'manual', 'api'
  -- Additional debug info
  raw_box_score_data JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prop_settlement_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own audit logs
CREATE POLICY "Users can view own audit logs"
  ON public.prop_settlement_audit_log
  FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() IS NOT NULL);

-- Allow inserts from authenticated users
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.prop_settlement_audit_log
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create indexes
CREATE INDEX idx_settlement_audit_entry_id ON public.prop_settlement_audit_log(entry_id);
CREATE INDEX idx_settlement_audit_user_id ON public.prop_settlement_audit_log(user_id);
CREATE INDEX idx_settlement_audit_game_date ON public.prop_settlement_audit_log(game_date);
CREATE INDEX idx_settlement_audit_settled_at ON public.prop_settlement_audit_log(settled_at);