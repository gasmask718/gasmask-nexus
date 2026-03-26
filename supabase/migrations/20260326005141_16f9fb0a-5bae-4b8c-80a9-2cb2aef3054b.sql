
ALTER TABLE public.sbo_actual_bets
  ADD COLUMN IF NOT EXISTS prediction_id uuid REFERENCES public.sbo_predictions(id),
  ADD COLUMN IF NOT EXISTS pick_tier text,
  ADD COLUMN IF NOT EXISTS signal_score numeric;
