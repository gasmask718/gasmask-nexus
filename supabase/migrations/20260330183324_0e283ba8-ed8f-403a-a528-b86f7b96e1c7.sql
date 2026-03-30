
-- PHASE A: Autonomy Core Schema

-- 1. system_alert_config table
CREATE TABLE IF NOT EXISTS public.system_alert_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_name text UNIQUE NOT NULL,
  alert_phone text,
  alerts_enabled boolean NOT NULL DEFAULT true,
  sms_throttle_minutes integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_alert_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on system_alert_config"
  ON public.system_alert_config FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read system_alert_config"
  ON public.system_alert_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated update system_alert_config"
  ON public.system_alert_config FOR UPDATE TO authenticated USING (true);

-- Seed default row
INSERT INTO public.system_alert_config (system_name, alerts_enabled, sms_throttle_minutes)
VALUES ('ut_ambassador_pipeline', true, 30)
ON CONFLICT (system_name) DO NOTHING;

-- 2. system_operation_logs table
CREATE TABLE IF NOT EXISTS public.system_operation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_name text NOT NULL,
  operation_type text NOT NULL,
  success boolean NOT NULL DEFAULT true,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_operation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on system_operation_logs"
  ON public.system_operation_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read system_operation_logs"
  ON public.system_operation_logs FOR SELECT TO authenticated USING (true);

-- 3. Extend pipeline_health_logs with severity/escalation fields
ALTER TABLE public.pipeline_health_logs
  ADD COLUMN IF NOT EXISTS check_type text DEFAULT 'health_check',
  ADD COLUMN IF NOT EXISTS severity text DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS recurring_failure_key text,
  ADD COLUMN IF NOT EXISTS auto_heal_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_heal_details jsonb DEFAULT '{}';

-- 4. Extend unforgettable_ambassadors with boost/risk/tier lock fields
ALTER TABLE public.unforgettable_ambassadors
  ADD COLUMN IF NOT EXISTS is_tier_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS boost_reason text,
  ADD COLUMN IF NOT EXISTS boost_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS risk_reason text,
  ADD COLUMN IF NOT EXISTS risk_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS tier_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_clicks integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_leads integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_conversions integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_revenue_per_conversion numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_per_click numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS earnings_per_click numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reengagement_at timestamptz;

-- 5. Extend ut_ambassador_insights with priority and dismissed_at
ALTER TABLE public.ut_ambassador_insights
  ADD COLUMN IF NOT EXISTS priority integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

-- 6. Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_operation_logs;
