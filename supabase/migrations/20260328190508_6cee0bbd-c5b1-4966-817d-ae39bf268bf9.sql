
-- Capper performance tracking table (per sport/stat breakdowns)
CREATE TABLE public.sbo_capper_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capper_id uuid REFERENCES public.sbo_cappers(id) ON DELETE CASCADE NOT NULL,
  sport text NOT NULL DEFAULT 'NBA',
  prop_type text,
  total_picks integer DEFAULT 0,
  wins integer DEFAULT 0,
  losses integer DEFAULT 0,
  pushes integer DEFAULT 0,
  win_rate numeric DEFAULT 0,
  last_7_picks integer DEFAULT 0,
  last_7_wins integer DEFAULT 0,
  last_7_win_rate numeric DEFAULT 0,
  last_30_picks integer DEFAULT 0,
  last_30_wins integer DEFAULT 0,
  last_30_win_rate numeric DEFAULT 0,
  avg_odds numeric,
  roi numeric DEFAULT 0,
  hot_streak integer DEFAULT 0,
  cold_streak integer DEFAULT 0,
  confidence_grade text DEFAULT 'C',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(capper_id, sport, prop_type)
);

ALTER TABLE public.sbo_capper_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read sbo_capper_performance" ON public.sbo_capper_performance FOR SELECT USING (true);
CREATE POLICY "Auth insert sbo_capper_performance" ON public.sbo_capper_performance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update sbo_capper_performance" ON public.sbo_capper_performance FOR UPDATE TO authenticated USING (true);

-- Add consensus fields to props_master if not exists
ALTER TABLE public.props_master ADD COLUMN IF NOT EXISTS consensus_over integer DEFAULT 0;
ALTER TABLE public.props_master ADD COLUMN IF NOT EXISTS consensus_under integer DEFAULT 0;
ALTER TABLE public.props_master ADD COLUMN IF NOT EXISTS consensus_score numeric;
ALTER TABLE public.props_master ADD COLUMN IF NOT EXISTS signal_strength text;
ALTER TABLE public.props_master ADD COLUMN IF NOT EXISTS is_value_play boolean DEFAULT false;
ALTER TABLE public.props_master ADD COLUMN IF NOT EXISTS value_score numeric;

-- Add edge/alignment fields to capper picks
ALTER TABLE public.sbo_capper_picks ADD COLUMN IF NOT EXISTS edge_score numeric;
ALTER TABLE public.sbo_capper_picks ADD COLUMN IF NOT EXISTS alignment_score numeric;
ALTER TABLE public.sbo_capper_picks ADD COLUMN IF NOT EXISTS sharp_flag boolean DEFAULT false;
