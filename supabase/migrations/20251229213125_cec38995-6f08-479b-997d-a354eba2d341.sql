-- Create daily_prediction_snapshots table for historical outcome tracking
CREATE TABLE public.daily_prediction_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  sport TEXT NOT NULL DEFAULT 'NBA',
  game_id TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  predicted_winner TEXT NOT NULL,
  predicted_win_probability NUMERIC(5,4),
  confidence_score NUMERIC(5,4),
  model_version TEXT DEFAULT 'v1',
  is_backfilled BOOLEAN DEFAULT false,
  actual_winner TEXT,
  home_score INTEGER,
  away_score INTEGER,
  game_status TEXT,
  success BOOLEAN,
  result_linked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(snapshot_date, game_id)
);

-- Enable RLS
ALTER TABLE public.daily_prediction_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow public read access (predictions are not user-specific)
CREATE POLICY "Anyone can view prediction snapshots"
ON public.daily_prediction_snapshots
FOR SELECT
USING (true);

-- Allow authenticated users to insert/update (for the system)
CREATE POLICY "Authenticated users can insert snapshots"
ON public.daily_prediction_snapshots
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update snapshots"
ON public.daily_prediction_snapshots
FOR UPDATE
USING (true);

-- Create index for efficient date-based queries
CREATE INDEX idx_prediction_snapshots_date ON public.daily_prediction_snapshots(snapshot_date DESC);
CREATE INDEX idx_prediction_snapshots_game ON public.daily_prediction_snapshots(game_id);

-- Create trigger for updated_at
CREATE TRIGGER update_prediction_snapshots_updated_at
BEFORE UPDATE ON public.daily_prediction_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();