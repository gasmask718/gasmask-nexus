-- 1. Live-mode unlock audit columns on dialer_settings
ALTER TABLE public.dialer_settings
  ADD COLUMN IF NOT EXISTS live_mode_unlocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS live_mode_unlocked_by uuid,
  ADD COLUMN IF NOT EXISTS live_mode_test_call_sid text;

-- 2. Cron: run the power-dialer engine cycle every minute
SELECT cron.unschedule('power-dialer-tick') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'power-dialer-tick');
SELECT cron.schedule(
  'power-dialer-tick',
  '* * * * *',
  $cmd$SELECT private.cron_post('power-dialer-tick', '{}'::jsonb) AS request_id;$cmd$
);

-- 3. Register in health_checks (standing rule: every cron is monitored)
INSERT INTO public.health_checks (
  check_key, kind, business, floor, label,
  cadence_expected_minutes, enabled, last_status
) VALUES (
  'cron.power-dialer-tick', 'cron', 'os', 'comms',
  'Power dialer tick (1m)', 5, true, 'unknown'
)
ON CONFLICT (check_key) DO UPDATE
SET cadence_expected_minutes = 5, enabled = true;