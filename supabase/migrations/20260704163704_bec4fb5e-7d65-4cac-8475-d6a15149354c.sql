
GRANT USAGE ON SCHEMA partners TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA partners TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA partners TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA partners TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA partners TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA partners TO authenticated, service_role;

ALTER VIEW public.dp_partners            SET (security_invoker = on);
ALTER VIEW public.dp_platforms           SET (security_invoker = on);
ALTER VIEW public.dp_ambassadors         SET (security_invoker = on);
ALTER VIEW public.dp_campaigns           SET (security_invoker = on);
ALTER VIEW public.dp_sales               SET (security_invoker = on);
ALTER VIEW public.dp_commission_splits   SET (security_invoker = on);
ALTER VIEW public.dp_payouts             SET (security_invoker = on);
ALTER VIEW public.dp_leads               SET (security_invoker = on);
ALTER VIEW public.dp_activity_log        SET (security_invoker = on);
ALTER VIEW public.dp_notifications       SET (security_invoker = on);
ALTER VIEW public.dp_mrr_subscriptions   SET (security_invoker = on);
ALTER VIEW public.dp_partner_platforms   SET (security_invoker = on);
ALTER VIEW public.dp_tracking_links      SET (security_invoker = on);
ALTER VIEW public.dp_outreach_messages   SET (security_invoker = on);
ALTER VIEW public.dp_ai_personas         SET (security_invoker = on);
ALTER VIEW public.dp_add_ons             SET (security_invoker = on);

CREATE OR REPLACE VIEW public.dp_partner_admins
  WITH (security_invoker = on) AS
  SELECT user_id, created_at
    FROM partners.partner_admins;

DO $$
DECLARE v text;
BEGIN
  FOR v IN
    SELECT viewname FROM pg_views
     WHERE schemaname='public' AND viewname LIKE 'dp\_%' ESCAPE '\'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', v);
    EXECUTE format('GRANT SELECT ON public.%I TO anon', v);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', v);
  END LOOP;
END $$;

INSERT INTO partners.partner_admins (user_id)
VALUES ('6019a316-2d95-4662-997c-c47bd0b37697')
ON CONFLICT DO NOTHING;
