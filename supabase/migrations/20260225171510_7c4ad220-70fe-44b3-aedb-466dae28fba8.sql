
-- Engine 1: Add is_high_override to production_demand_overrides
ALTER TABLE public.production_demand_overrides
  ADD COLUMN IF NOT EXISTS is_high_override boolean NOT NULL DEFAULT false;

-- Engine 2: Create system_alerts table
CREATE TABLE IF NOT EXISTS public.system_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  brand text,
  severity text NOT NULL DEFAULT 'warning',
  message text NOT NULL,
  recommended_action text,
  dashboard_link text,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  throttle_key text,
  alert_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Throttle: max one alert per type+brand per day using immutable date column
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_alerts_throttle
  ON public.system_alerts (throttle_key, alert_date)
  WHERE throttle_key IS NOT NULL;

ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read system_alerts"
  ON public.system_alerts FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update system_alerts"
  ON public.system_alerts FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- Engine 3: Add auto-draft columns to production_batches
ALTER TABLE public.production_batches
  ADD COLUMN IF NOT EXISTS generated_by_system boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS system_generation_note text;
