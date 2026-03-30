
-- Add performance tier and AI optimization columns to unforgettable_ambassadors
ALTER TABLE public.unforgettable_ambassadors 
  ADD COLUMN IF NOT EXISTS performance_tier text NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS is_boosted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS risk_level text DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS last_insight_at timestamptz,
  ADD COLUMN IF NOT EXISTS conversion_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_managed boolean NOT NULL DEFAULT true;

-- Ambassador insights table for AI recommendations
CREATE TABLE IF NOT EXISTS public.ut_ambassador_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid REFERENCES public.unforgettable_ambassadors(id) ON DELETE CASCADE NOT NULL,
  insight_type text NOT NULL,
  insight_text text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  is_resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ut_ambassador_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read on ut_ambassador_insights" 
  ON public.ut_ambassador_insights FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow service insert on ut_ambassador_insights" 
  ON public.ut_ambassador_insights FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow service update on ut_ambassador_insights" 
  ON public.ut_ambassador_insights FOR UPDATE TO authenticated USING (true);
