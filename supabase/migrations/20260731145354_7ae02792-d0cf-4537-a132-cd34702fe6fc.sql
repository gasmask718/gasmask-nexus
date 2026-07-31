CREATE OR REPLACE VIEW public.v_phone_directory
WITH (security_invoker = true) AS
SELECT
  d.phone_number AS phone_e164,
  right(regexp_replace(coalesce(d.phone_number,''), '\D', '', 'g'), 10) AS last10,
  d.business,
  NULL::uuid AS business_id,
  d.assigned_agent_id,
  d.assigned_va_id,
  coalesce(d.is_active, false) AS is_active,
  d.sms_webhook_url,
  d.webhook_url AS voice_webhook_url,
  coalesce(d.display_name, d.friendly_name) AS label,
  d.number_type,
  'dc_phone_numbers'::text AS source
FROM public.dc_phone_numbers d
WHERE d.phone_number IS NOT NULL
UNION ALL
SELECT
  b.phone_number AS phone_e164,
  right(regexp_replace(coalesce(b.phone_number,''), '\D', '', 'g'), 10) AS last10,
  coalesce(bus.slug, lower(replace(bus.name, ' ', '_'))) AS business,
  b.business_id,
  b.assigned_agent_id,
  b.assigned_va_id,
  coalesce(b.is_active, false) AS is_active,
  b.sms_webhook_url,
  b.voice_webhook_url,
  b.label,
  b.type AS number_type,
  'business_phone_numbers'::text AS source
FROM public.business_phone_numbers b
LEFT JOIN public.businesses bus ON bus.id = b.business_id
WHERE b.phone_number IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.dc_phone_numbers d2
    WHERE right(regexp_replace(coalesce(d2.phone_number,''), '\D', '', 'g'), 10)
        = right(regexp_replace(coalesce(b.phone_number,''), '\D', '', 'g'), 10)
  );

GRANT SELECT ON public.v_phone_directory TO authenticated;
GRANT SELECT ON public.v_phone_directory TO service_role;

CREATE TABLE IF NOT EXISTS public.comms_health_alerts (
  alert_key text PRIMARY KEY,
  last_alert_at timestamptz NOT NULL DEFAULT now(),
  last_status text,
  last_message text,
  alert_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.comms_health_alerts TO authenticated;
GRANT ALL ON public.comms_health_alerts TO service_role;

ALTER TABLE public.comms_health_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read comms health alerts"
ON public.comms_health_alerts FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_comms_health_alerts_updated_at
BEFORE UPDATE ON public.comms_health_alerts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();