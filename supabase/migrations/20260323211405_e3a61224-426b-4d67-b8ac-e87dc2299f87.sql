
-- Add parlay_date column to sbo_parlays if missing
ALTER TABLE public.sbo_parlays ADD COLUMN IF NOT EXISTS parlay_date date;
ALTER TABLE public.sbo_parlays ADD COLUMN IF NOT EXISTS odds integer;
ALTER TABLE public.sbo_parlays ADD COLUMN IF NOT EXISTS stake numeric DEFAULT 0;
ALTER TABLE public.sbo_parlays ADD COLUMN IF NOT EXISTS potential_payout numeric;

-- Create normalized parlay legs table
CREATE TABLE IF NOT EXISTS public.sbo_parlay_legs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parlay_id uuid REFERENCES public.sbo_parlays(id) ON DELETE CASCADE NOT NULL,
  prediction_id uuid,
  prop_id uuid,
  game_id text,
  leg_type text,
  label text,
  odds integer,
  pick text,
  confidence integer,
  result text DEFAULT 'pending',
  verified_at timestamptz,
  actual_value numeric,
  line numeric,
  verdict_note text,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.sbo_parlay_legs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to sbo_parlay_legs" ON public.sbo_parlay_legs FOR ALL USING (true) WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_sbo_parlay_legs_parlay_id ON public.sbo_parlay_legs(parlay_id);
CREATE INDEX IF NOT EXISTS idx_sbo_parlay_legs_prediction_id ON public.sbo_parlay_legs(prediction_id);
