
-- Add multi-sport columns to sbo_capper_picks
ALTER TABLE public.sbo_capper_picks 
  ADD COLUMN IF NOT EXISTS sport text DEFAULT 'NBA',
  ADD COLUMN IF NOT EXISTS league text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bet_type text DEFAULT 'prop',
  ADD COLUMN IF NOT EXISTS parse_confidence numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'verified',
  ADD COLUMN IF NOT EXISTS source_image_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS matched_prop_id uuid DEFAULT NULL;

-- Add sport specialties to cappers
ALTER TABLE public.sbo_cappers
  ADD COLUMN IF NOT EXISTS sports text[] DEFAULT '{NBA}',
  ADD COLUMN IF NOT EXISTS best_sport text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS picks_by_sport jsonb DEFAULT '{}';

-- Add index for sport filtering
CREATE INDEX IF NOT EXISTS idx_capper_picks_sport ON public.sbo_capper_picks(sport);
CREATE INDEX IF NOT EXISTS idx_capper_picks_review ON public.sbo_capper_picks(review_status);
