
-- Lead Performance Tracking
CREATE TABLE public.brandaro_lead_performance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.brandaro_qualified_leads(id) ON DELETE CASCADE NOT NULL,
  sms_sent INTEGER NOT NULL DEFAULT 0,
  sms_replied BOOLEAN NOT NULL DEFAULT false,
  call_picked_up BOOLEAN NOT NULL DEFAULT false,
  interested BOOLEAN NOT NULL DEFAULT false,
  converted BOOLEAN NOT NULL DEFAULT false,
  lead_score INTEGER NOT NULL DEFAULT 0,
  last_action_at TIMESTAMPTZ,
  last_response_at TIMESTAMPTZ,
  response_time_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lead_id)
);

-- Script Performance Tracking (A/B variants)
CREATE TABLE public.brandaro_script_performance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  variant_key TEXT NOT NULL,
  variant_label TEXT NOT NULL DEFAULT '',
  script_type TEXT NOT NULL DEFAULT 'sms_opener',
  send_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  conversion_count INTEGER NOT NULL DEFAULT 0,
  reply_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  conversion_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  usage_weight NUMERIC(5,2) NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(variant_key, script_type)
);

-- Seed initial A/B variants
INSERT INTO public.brandaro_script_performance (variant_key, variant_label, script_type, usage_weight)
VALUES
  ('A', 'Curiosity + Question', 'sms_opener', 50),
  ('B', 'Direct Value', 'sms_opener', 50),
  ('A', '15-min Follow-up', 'sms_followup', 50),
  ('B', '2-hour Follow-up', 'sms_followup', 50);

-- Enable RLS
ALTER TABLE public.brandaro_lead_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_script_performance ENABLE ROW LEVEL SECURITY;

-- Allow authenticated read/write
CREATE POLICY "Authenticated users can manage lead performance"
  ON public.brandaro_lead_performance FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage script performance"
  ON public.brandaro_script_performance FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow service role full access (for edge functions)
CREATE POLICY "Service role full access to lead performance"
  ON public.brandaro_lead_performance FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to script performance"
  ON public.brandaro_script_performance FOR ALL TO service_role USING (true) WITH CHECK (true);
