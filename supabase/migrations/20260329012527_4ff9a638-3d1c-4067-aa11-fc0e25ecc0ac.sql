
CREATE TABLE IF NOT EXISTS public.sbo_learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  game_date text,
  player_name text,
  prop_type text,
  line numeric,
  direction text,
  sport text,
  final_score numeric NOT NULL DEFAULT 0,
  signal_tier text,
  ai_confidence numeric,
  capper_consensus integer DEFAULT 0,
  capper_weight numeric DEFAULT 0,
  capper_avg_roi numeric DEFAULT 0,
  capper_avg_grade text,
  market_type text,
  alignment text,
  alignment_bonus boolean DEFAULT false,
  risk_tag text,
  result text NOT NULL,
  short_reason text,
  full_reason text
);

CREATE TABLE IF NOT EXISTS public.sbo_dynamic_weights (
  id integer PRIMARY KEY DEFAULT 1,
  ai_weight numeric NOT NULL DEFAULT 0.40,
  consensus_weight numeric NOT NULL DEFAULT 0.15,
  capper_weight numeric NOT NULL DEFAULT 0.20,
  roi_weight numeric NOT NULL DEFAULT 0.15,
  market_weight numeric NOT NULL DEFAULT 0.10,
  alignment_bonus numeric NOT NULL DEFAULT 10,
  last_recalibrated_at timestamptz,
  recalibration_count integer NOT NULL DEFAULT 0,
  sample_size integer NOT NULL DEFAULT 0,
  weights_locked boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.sbo_dynamic_weights (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.sbo_learning_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sbo_dynamic_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read sbo_learning_events" ON public.sbo_learning_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert sbo_learning_events" ON public.sbo_learning_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated read sbo_dynamic_weights" ON public.sbo_dynamic_weights FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated update sbo_dynamic_weights" ON public.sbo_dynamic_weights FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Also ensure sbo_decision_weight_history exists
CREATE TABLE IF NOT EXISTS public.sbo_decision_weight_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  ai_weight_before numeric,
  ai_weight_after numeric,
  consensus_weight_before numeric,
  consensus_weight_after numeric,
  capper_weight_before numeric,
  capper_weight_after numeric,
  roi_weight_before numeric,
  roi_weight_after numeric,
  market_weight_before numeric,
  market_weight_after numeric,
  alignment_bonus_before numeric,
  alignment_bonus_after numeric,
  trigger_reason text,
  sample_size integer,
  adjustments_applied jsonb,
  pre_recal_win_rate numeric,
  post_recal_win_rate numeric
);

ALTER TABLE public.sbo_decision_weight_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read sbo_decision_weight_history" ON public.sbo_decision_weight_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert sbo_decision_weight_history" ON public.sbo_decision_weight_history FOR INSERT TO authenticated WITH CHECK (true);
