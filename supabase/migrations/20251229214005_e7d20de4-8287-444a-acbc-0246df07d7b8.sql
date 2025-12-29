-- Create manual_backfill_entries table for recording historical outcomes
CREATE TABLE public.manual_backfill_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  sport TEXT NOT NULL DEFAULT 'NBA',
  market TEXT NOT NULL, -- 'Moneyline' or 'Player Prop'
  
  -- For Moneyline
  home_team TEXT,
  away_team TEXT,
  predicted_side TEXT, -- 'Home' or 'Away'
  
  -- For Player Props
  player_name TEXT,
  stat_type TEXT, -- 'Points', 'Rebounds', etc.
  prop_line NUMERIC,
  predicted_direction TEXT, -- 'MORE' or 'LESS'
  
  -- Prediction details
  confidence NUMERIC,
  
  -- Result details
  result TEXT NOT NULL, -- 'W', 'L', 'Push'
  actual_winner TEXT, -- For moneylines
  actual_stat_value NUMERIC, -- For props
  home_score INTEGER,
  away_score INTEGER,
  
  -- Metadata
  source TEXT NOT NULL DEFAULT 'manual_backfill',
  status TEXT NOT NULL DEFAULT 'settled',
  locked BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.manual_backfill_entries ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all entries
CREATE POLICY "Anyone can view manual backfill entries"
  ON public.manual_backfill_entries
  FOR SELECT
  USING (true);

-- Allow authenticated users to insert entries
CREATE POLICY "Authenticated users can create backfill entries"
  ON public.manual_backfill_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update their own entries
CREATE POLICY "Users can update their own entries"
  ON public.manual_backfill_entries
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

-- Create index for date queries
CREATE INDEX idx_manual_backfill_date ON public.manual_backfill_entries(date);
CREATE INDEX idx_manual_backfill_sport_market ON public.manual_backfill_entries(sport, market);

-- Create updated_at trigger
CREATE TRIGGER update_manual_backfill_entries_updated_at
  BEFORE UPDATE ON public.manual_backfill_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();