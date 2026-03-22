
-- Results verification table
CREATE TABLE IF NOT EXISTS public.sbo_results_verification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id uuid REFERENCES public.sbo_predictions(id),
  game_id text,
  pick_type text,
  our_pick text,
  our_confidence integer,
  final_score_home integer,
  final_score_away integer,
  actual_result text,
  verdict text,
  profit_loss numeric,
  stake numeric DEFAULT 0,
  verified_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sbo_results_verification ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on sbo_results_verification" ON public.sbo_results_verification FOR ALL USING (true) WITH CHECK (true);

-- Add verification columns to sbo_predictions
ALTER TABLE public.sbo_predictions
  ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS verdict text,
  ADD COLUMN IF NOT EXISTS final_score_home integer,
  ADD COLUMN IF NOT EXISTS final_score_away integer,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Add verification columns to sbo_player_props
ALTER TABLE public.sbo_player_props
  ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS verdict text,
  ADD COLUMN IF NOT EXISTS actual_value numeric,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;
