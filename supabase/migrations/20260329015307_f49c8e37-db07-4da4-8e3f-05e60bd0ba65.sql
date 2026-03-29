CREATE TABLE IF NOT EXISTS public.sbo_prop_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name text NOT NULL,
  stat_type text NOT NULL,
  line numeric NOT NULL,
  game_date text NOT NULL,
  direction text,
  prediction text,
  confidence numeric,
  final_score numeric,
  signal_tier text,
  risk_tag text,
  short_reason text,
  full_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_name, stat_type, line, game_date)
);

ALTER TABLE public.sbo_prop_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read sbo_prop_predictions" ON public.sbo_prop_predictions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert sbo_prop_predictions" ON public.sbo_prop_predictions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update sbo_prop_predictions" ON public.sbo_prop_predictions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);