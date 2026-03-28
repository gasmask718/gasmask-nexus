
-- ROI tracking per capper / sport / market
CREATE TABLE IF NOT EXISTS public.sbo_capper_roi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capper_id UUID REFERENCES public.sbo_cappers(id) ON DELETE CASCADE NOT NULL,
  sport TEXT NOT NULL DEFAULT 'ALL',
  market_type TEXT NOT NULL DEFAULT 'ALL',
  total_bets INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  pushes INTEGER DEFAULT 0,
  win_rate NUMERIC DEFAULT 0,
  total_profit NUMERIC DEFAULT 0,
  roi_percentage NUMERIC DEFAULT 0,
  avg_odds NUMERIC DEFAULT -110,
  best_streak INTEGER DEFAULT 0,
  worst_streak INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(capper_id, sport, market_type)
);

ALTER TABLE public.sbo_capper_roi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read sbo_capper_roi" ON public.sbo_capper_roi FOR SELECT USING (true);
CREATE POLICY "Auth insert sbo_capper_roi" ON public.sbo_capper_roi FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update sbo_capper_roi" ON public.sbo_capper_roi FOR UPDATE TO authenticated USING (true);

-- Add grade and weight columns to sbo_cappers if not exists
DO $$ BEGIN
  ALTER TABLE public.sbo_cappers ADD COLUMN IF NOT EXISTS grade TEXT DEFAULT 'C';
  ALTER TABLE public.sbo_cappers ADD COLUMN IF NOT EXISTS capper_weight NUMERIC DEFAULT 1.0;
  ALTER TABLE public.sbo_cappers ADD COLUMN IF NOT EXISTS hot_streak INTEGER DEFAULT 0;
  ALTER TABLE public.sbo_cappers ADD COLUMN IF NOT EXISTS cold_streak INTEGER DEFAULT 0;
  ALTER TABLE public.sbo_cappers ADD COLUMN IF NOT EXISTS best_market TEXT;
  ALTER TABLE public.sbo_cappers ADD COLUMN IF NOT EXISTS best_sport TEXT;
END $$;
