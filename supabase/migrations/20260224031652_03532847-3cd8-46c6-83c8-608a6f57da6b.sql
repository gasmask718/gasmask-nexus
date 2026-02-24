
-- Phase F: Cost Control + Compliance + Scaling Guardrails

-- 1. Call Cost Events (billable tracking)
CREATE TABLE IF NOT EXISTS public.call_cost_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id),
  call_sid text,
  queue_item_id uuid,
  campaign_id uuid,
  rep_user_id uuid,
  store_id uuid,
  duration_seconds integer DEFAULT 0,
  billable_minutes numeric DEFAULT 0,
  estimated_cost numeric DEFAULT 0,
  rate_per_minute numeric DEFAULT 0.0085,
  carrier text DEFAULT 'twilio',
  cost_type text DEFAULT 'voice',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.call_cost_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members view cost events"
  ON public.call_cost_events FOR SELECT
  USING (business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  ));

-- 2. Dialer Global Limits (kill switch)
CREATE TABLE IF NOT EXISTS public.dialer_global_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) UNIQUE,
  max_daily_calls integer DEFAULT 500,
  max_daily_cost numeric DEFAULT 50.00,
  max_hourly_calls integer DEFAULT 100,
  auto_pause_on_limit boolean DEFAULT true,
  paused_at timestamptz,
  paused_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.dialer_global_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members manage global limits"
  ON public.dialer_global_limits FOR ALL
  USING (business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  ));

-- 3. Store Answer Profile (answer intelligence)
CREATE TABLE IF NOT EXISTS public.store_answer_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.store_master(id) UNIQUE,
  business_id uuid REFERENCES public.businesses(id),
  total_attempts integer DEFAULT 0,
  total_answers integer DEFAULT 0,
  answer_rate numeric DEFAULT 0,
  best_hour integer,
  best_day_of_week integer,
  hour_distribution jsonb DEFAULT '{}'::jsonb,
  day_distribution jsonb DEFAULT '{}'::jsonb,
  last_attempt_at timestamptz,
  last_answer_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.store_answer_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members view answer profiles"
  ON public.store_answer_profile FOR SELECT
  USING (business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  ));

-- 4. Compliance columns on store_master
ALTER TABLE public.store_master
  ADD COLUMN IF NOT EXISTS consent_source text,
  ADD COLUMN IF NOT EXISTS consent_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS last_opt_out_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS do_not_call_reason text,
  ADD COLUMN IF NOT EXISTS opt_out_method text;

-- 5. Opt-out events table (compliance log)
CREATE TABLE IF NOT EXISTS public.dialer_opt_out_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id),
  store_id uuid,
  phone_number text,
  session_id uuid,
  rep_user_id uuid,
  reason text,
  method text DEFAULT 'verbal',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.dialer_opt_out_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members view opt-out events"
  ON public.dialer_opt_out_events FOR SELECT
  USING (business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  ));

-- 6. Campaign margin view
CREATE OR REPLACE VIEW public.v_campaign_margin AS
SELECT
  c.id AS campaign_id,
  c.business_id,
  c.name AS campaign_name,
  c.status,
  COALESCE(c.total_revenue, 0) AS revenue,
  COALESCE(costs.total_cost, 0) AS total_cost,
  COALESCE(c.total_revenue, 0) - COALESCE(costs.total_cost, 0) AS net_profit,
  CASE WHEN COALESCE(c.total_revenue, 0) > 0
    THEN ((COALESCE(c.total_revenue, 0) - COALESCE(costs.total_cost, 0)) / c.total_revenue * 100)
    ELSE 0 END AS margin_pct,
  COALESCE(costs.total_calls, 0) AS total_calls,
  CASE WHEN COALESCE(costs.total_calls, 0) > 0
    THEN COALESCE(c.total_revenue, 0) / costs.total_calls
    ELSE 0 END AS revenue_per_dial,
  CASE WHEN COALESCE(costs.total_calls, 0) > 0
    THEN COALESCE(costs.total_cost, 0) / costs.total_calls
    ELSE 0 END AS cost_per_dial,
  CASE WHEN COALESCE(costs.total_calls, 0) > 0
    THEN (COALESCE(c.total_revenue, 0) - COALESCE(costs.total_cost, 0)) / costs.total_calls
    ELSE 0 END AS profit_per_dial,
  COALESCE(costs.total_minutes, 0) AS total_minutes
FROM public.dialer_campaigns c
LEFT JOIN (
  SELECT
    campaign_id,
    COUNT(*) AS total_calls,
    SUM(estimated_cost) AS total_cost,
    SUM(billable_minutes) AS total_minutes
  FROM public.call_cost_events
  GROUP BY campaign_id
) costs ON costs.campaign_id = c.id;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_cost_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dialer_opt_out_events;
