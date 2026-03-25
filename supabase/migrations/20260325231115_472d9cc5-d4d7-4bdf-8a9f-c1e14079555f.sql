
-- Signal Weighting Engine tables

CREATE TABLE public.sbo_signal_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id text NOT NULL,
  sbo_confidence integer NOT NULL DEFAULT 50,
  wallet_alignment_count integer NOT NULL DEFAULT 0,
  elite_wallets_count integer NOT NULL DEFAULT 0,
  capper_alignment_count integer NOT NULL DEFAULT 0,
  top_cappers_count integer NOT NULL DEFAULT 0,
  conflict_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sbo_weighted_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id text NOT NULL,
  final_score integer NOT NULL DEFAULT 0,
  pick_tier text NOT NULL DEFAULT 'low',
  is_grandmaster boolean NOT NULL DEFAULT false,
  reasoning text,
  sbo_component numeric NOT NULL DEFAULT 0,
  wallet_component numeric NOT NULL DEFAULT 0,
  capper_component numeric NOT NULL DEFAULT 0,
  conflict_penalty numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sbo_signal_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sbo_weighted_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to signal inputs" ON public.sbo_signal_inputs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to weighted picks" ON public.sbo_weighted_picks FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_sbo_weighted_picks_tier ON public.sbo_weighted_picks(pick_tier);
CREATE INDEX idx_sbo_weighted_picks_grandmaster ON public.sbo_weighted_picks(is_grandmaster) WHERE is_grandmaster = true;
CREATE INDEX idx_sbo_weighted_picks_prediction ON public.sbo_weighted_picks(prediction_id);
CREATE INDEX idx_sbo_signal_inputs_prediction ON public.sbo_signal_inputs(prediction_id);
