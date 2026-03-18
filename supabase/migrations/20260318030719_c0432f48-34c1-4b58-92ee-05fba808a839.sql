
-- Conversion Predictions (per-lead probability engine)
CREATE TABLE public.brandaro_conversion_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.brandaro_qualified_leads(id) ON DELETE CASCADE NOT NULL,
  conversion_probability NUMERIC(5,2) NOT NULL DEFAULT 0,
  priority_tier TEXT NOT NULL DEFAULT 'low',
  action_strategy TEXT NOT NULL DEFAULT 'slow_nurture',
  scoring_factors JSONB NOT NULL DEFAULT '{}',
  best_contact_hour INTEGER,
  best_contact_day INTEGER,
  predicted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acted_on BOOLEAN NOT NULL DEFAULT false,
  outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lead_id)
);

-- Revenue Tracking (per lead, script, industry)
CREATE TABLE public.brandaro_revenue_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.brandaro_qualified_leads(id) ON DELETE SET NULL,
  revenue_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  revenue_type TEXT NOT NULL DEFAULT 'deal_closed',
  attributed_script_variant TEXT,
  attributed_industry TEXT,
  attributed_campaign TEXT,
  close_time_hours NUMERIC(8,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Niche performance aggregation
CREATE TABLE public.brandaro_niche_performance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  industry TEXT NOT NULL UNIQUE,
  total_leads INTEGER NOT NULL DEFAULT 0,
  total_contacted INTEGER NOT NULL DEFAULT 0,
  total_replied INTEGER NOT NULL DEFAULT 0,
  total_converted INTEGER NOT NULL DEFAULT 0,
  total_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  conversion_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  revenue_per_lead NUMERIC(8,2) NOT NULL DEFAULT 0,
  avg_response_time_min NUMERIC(8,2),
  best_hour INTEGER,
  best_day INTEGER,
  is_hot_niche BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.brandaro_conversion_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_revenue_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_niche_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth manage conversion predictions" ON public.brandaro_conversion_predictions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role conversion predictions" ON public.brandaro_conversion_predictions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Auth manage revenue tracking" ON public.brandaro_revenue_tracking FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role revenue tracking" ON public.brandaro_revenue_tracking FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Auth manage niche performance" ON public.brandaro_niche_performance FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role niche performance" ON public.brandaro_niche_performance FOR ALL TO service_role USING (true) WITH CHECK (true);
