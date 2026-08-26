INSERT INTO public.system_alert_config (system_name, alerts_enabled, sms_throttle_minutes, updated_at)
VALUES
  ('system_health_monitoring', true, 360, now()),
  ('system_health_sms', false, 360, now()),
  ('comms_health_monitoring', true, 360, now()),
  ('comms_health_sms', false, 360, now())
ON CONFLICT (system_name) DO UPDATE
SET alerts_enabled = EXCLUDED.alerts_enabled,
    sms_throttle_minutes = EXCLUDED.sms_throttle_minutes,
    updated_at = now();

GRANT SELECT ON public.system_alert_config TO authenticated;
GRANT UPDATE ON public.system_alert_config TO authenticated;
GRANT ALL ON public.system_alert_config TO service_role;

DROP POLICY IF EXISTS "Authenticated update system_alert_config" ON public.system_alert_config;
DROP POLICY IF EXISTS "Admins update system_alert_config" ON public.system_alert_config;
CREATE POLICY "Admins update system_alert_config"
ON public.system_alert_config
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'owner'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'owner'::public.app_role)
);