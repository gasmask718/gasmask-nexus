
-- AI call log for Brandaro automated calls
CREATE TABLE IF NOT EXISTS public.brandaro_ai_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.brandaro_leads_master(id),
  language TEXT NOT NULL DEFAULT 'spanish',
  call_sid TEXT,
  status TEXT DEFAULT 'queued',
  outcome TEXT,
  interest_level TEXT,
  transcript TEXT,
  ai_score INTEGER,
  duration_seconds INTEGER,
  called_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_ai_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view AI calls"
  ON public.brandaro_ai_calls FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role can insert AI calls"
  ON public.brandaro_ai_calls FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Service role can update AI calls"
  ON public.brandaro_ai_calls FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- Lead distribution log
CREATE TABLE IF NOT EXISTS public.brandaro_lead_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.brandaro_leads_master(id),
  assigned_to UUID REFERENCES public.profiles(id),
  assigned_by TEXT DEFAULT 'system',
  distribution_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_lead_distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view distributions"
  ON public.brandaro_lead_distributions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Auth users can insert distributions"
  ON public.brandaro_lead_distributions FOR INSERT
  TO authenticated WITH CHECK (true);

-- Revenue tracking per division
CREATE TABLE IF NOT EXISTS public.brandaro_division_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division TEXT NOT NULL,
  country TEXT,
  language TEXT,
  amount NUMERIC DEFAULT 0,
  deal_count INTEGER DEFAULT 0,
  period TEXT,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_division_revenue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view revenue"
  ON public.brandaro_division_revenue FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Auth users can insert revenue"
  ON public.brandaro_division_revenue FOR INSERT
  TO authenticated WITH CHECK (true);
