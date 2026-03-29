
-- New weight audit table for the decision engine weights
CREATE TABLE public.sbo_decision_weight_history (
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
  adjustments_applied jsonb
);

ALTER TABLE public.sbo_decision_weight_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read on sbo_decision_weight_history" ON public.sbo_decision_weight_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on sbo_decision_weight_history" ON public.sbo_decision_weight_history FOR INSERT TO authenticated WITH CHECK (true);
