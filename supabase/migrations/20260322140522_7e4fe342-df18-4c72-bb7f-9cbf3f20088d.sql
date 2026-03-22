CREATE TABLE IF NOT EXISTS public.sbo_saved_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_type text,
  label text,
  detail text,
  odds text,
  stake numeric DEFAULT 0,
  potential_payout numeric DEFAULT 0,
  ai_analysis text,
  confidence integer,
  source_table text,
  source_id uuid,
  result text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sbo_saved_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on sbo_saved_picks" ON public.sbo_saved_picks
  FOR ALL USING (true) WITH CHECK (true);