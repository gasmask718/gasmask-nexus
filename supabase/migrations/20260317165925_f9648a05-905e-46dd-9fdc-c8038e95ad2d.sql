
-- Revenue Intelligence Layer for Brandaro

-- Revenue events tracking (proposal → payment → subscription lifecycle)
CREATE TABLE public.brandaro_revenue_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.brandaro_clients(id) ON DELETE CASCADE,
  project_id UUID,
  build_job_id UUID,
  template_id UUID,
  design_profile_id UUID,
  event_type TEXT NOT NULL, -- proposal_sent, proposal_viewed, checkout_started, payment_completed, subscription_active, subscription_churned
  event_value NUMERIC DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Revenue attribution per template/design profile
CREATE TABLE public.brandaro_revenue_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID,
  design_profile_id UUID,
  build_job_id UUID,
  client_id UUID,
  revenue_generated NUMERIC DEFAULT 0,
  close_rate NUMERIC DEFAULT 0,
  average_order_value NUMERIC DEFAULT 0,
  subscription_months INTEGER DEFAULT 0,
  lifetime_value NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add revenue columns to design profiles
ALTER TABLE public.brandaro_design_profiles 
  ADD COLUMN IF NOT EXISTS revenue_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_revenue NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS close_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_order_value NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS builds_with_payment INTEGER DEFAULT 0;

-- Add revenue columns to conversion patterns
ALTER TABLE public.brandaro_conversion_patterns
  ADD COLUMN IF NOT EXISTS revenue_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_revenue NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS close_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS builds_with_payment INTEGER DEFAULT 0;

-- Add revenue columns to extracted templates
ALTER TABLE public.brandaro_extracted_templates
  ADD COLUMN IF NOT EXISTS revenue_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_revenue NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS close_rate NUMERIC DEFAULT 0;

-- Index for fast lookups
CREATE INDEX idx_revenue_events_client ON public.brandaro_revenue_events(client_id);
CREATE INDEX idx_revenue_events_type ON public.brandaro_revenue_events(event_type);
CREATE INDEX idx_revenue_attribution_template ON public.brandaro_revenue_attribution(template_id);
CREATE INDEX idx_revenue_attribution_profile ON public.brandaro_revenue_attribution(design_profile_id);

-- RLS
ALTER TABLE public.brandaro_revenue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_revenue_attribution ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on revenue events" ON public.brandaro_revenue_events FOR ALL USING (true);
CREATE POLICY "Service role full access on revenue attribution" ON public.brandaro_revenue_attribution FOR ALL USING (true);
