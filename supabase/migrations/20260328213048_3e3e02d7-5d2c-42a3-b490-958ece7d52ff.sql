
-- Isolated external results table for capper intelligence ONLY
-- NOT connected to props_master or main prediction engine
CREATE TABLE IF NOT EXISTS public.sbo_external_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text,
  sport text NOT NULL DEFAULT 'NBA',
  player_name text NOT NULL,
  team text,
  opponent text,
  stat_type text NOT NULL,
  actual_value numeric,
  game_date date NOT NULL,
  source text NOT NULL DEFAULT 'api',
  api_provider text,
  verified boolean DEFAULT true,
  raw_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(player_name, stat_type, game_date, sport)
);

ALTER TABLE public.sbo_external_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read on sbo_external_results"
  ON public.sbo_external_results FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on sbo_external_results"
  ON public.sbo_external_results FOR INSERT TO authenticated WITH CHECK (true);

-- Add data_source flag to capper picks for isolation tracking
ALTER TABLE public.sbo_capper_picks
  ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_result_id uuid REFERENCES public.sbo_external_results(id);

-- Index for fast matching
CREATE INDEX IF NOT EXISTS idx_sbo_external_results_lookup
  ON public.sbo_external_results (player_name, stat_type, game_date);

CREATE INDEX IF NOT EXISTS idx_sbo_external_results_sport_date
  ON public.sbo_external_results (sport, game_date);
