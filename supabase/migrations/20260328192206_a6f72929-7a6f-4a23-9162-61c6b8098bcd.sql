
-- Signal performance tracking table
CREATE TABLE public.sbo_signal_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_type text NOT NULL,
  signal_strength text,
  prop_id uuid,
  consensus_score numeric,
  value_score numeric,
  ai_confidence numeric,
  capper_confidence numeric,
  composite_score numeric,
  result text DEFAULT 'pending',
  sport text DEFAULT 'NBA',
  stat_type text,
  game_date date,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.sbo_signal_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read sbo_signal_performance" ON public.sbo_signal_performance FOR SELECT USING (true);
CREATE POLICY "Auth insert sbo_signal_performance" ON public.sbo_signal_performance FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth update sbo_signal_performance" ON public.sbo_signal_performance FOR UPDATE USING (true);

-- Add composite scoring + sharp detection columns to props_master
ALTER TABLE public.props_master
  ADD COLUMN IF NOT EXISTS composite_score numeric,
  ADD COLUMN IF NOT EXISTS top_play_rank integer,
  ADD COLUMN IF NOT EXISTS sharp_indicator text,
  ADD COLUMN IF NOT EXISTS bet_size_pct numeric,
  ADD COLUMN IF NOT EXISTS play_reasons jsonb;

-- Add edge_score to capper picks if not exists
ALTER TABLE public.sbo_capper_picks
  ADD COLUMN IF NOT EXISTS confidence_score numeric;
