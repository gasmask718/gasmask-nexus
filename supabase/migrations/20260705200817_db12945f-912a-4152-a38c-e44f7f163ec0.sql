ALTER TABLE public.sbo_weight_history 
  ADD COLUMN IF NOT EXISTS sport_key TEXT,
  ADD COLUMN IF NOT EXISTS sample_size INTEGER;
CREATE INDEX IF NOT EXISTS idx_sbo_weight_history_sport ON public.sbo_weight_history(sport_key, adjusted_at DESC);