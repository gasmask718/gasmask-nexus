CREATE SCHEMA IF NOT EXISTS internal_analytics;

DROP VIEW IF EXISTS public.v_store_intelligence;
DROP VIEW IF EXISTS public.v_vendor_performance_summary;
DROP VIEW IF EXISTS public.v_store_invoice_activity;

ALTER MATERIALIZED VIEW public.store_intelligence_v SET SCHEMA internal_analytics;
ALTER MATERIALIZED VIEW public.vendor_performance_summary SET SCHEMA internal_analytics;
ALTER MATERIALIZED VIEW public.store_invoice_activity SET SCHEMA internal_analytics;

GRANT USAGE ON SCHEMA internal_analytics TO authenticated, service_role;
GRANT SELECT ON internal_analytics.store_intelligence_v TO authenticated, service_role;
GRANT SELECT ON internal_analytics.vendor_performance_summary TO authenticated, service_role;
GRANT SELECT ON internal_analytics.store_invoice_activity TO authenticated, service_role;

CREATE VIEW public.v_store_intelligence WITH (security_invoker = true) AS
  SELECT * FROM internal_analytics.store_intelligence_v WHERE auth.uid() IS NOT NULL;
CREATE VIEW public.v_vendor_performance_summary WITH (security_invoker = true) AS
  SELECT * FROM internal_analytics.vendor_performance_summary WHERE auth.uid() IS NOT NULL;
CREATE VIEW public.v_store_invoice_activity WITH (security_invoker = true) AS
  SELECT * FROM internal_analytics.store_invoice_activity WHERE auth.uid() IS NOT NULL;

GRANT SELECT ON public.v_store_intelligence TO authenticated;
GRANT SELECT ON public.v_vendor_performance_summary TO authenticated;
GRANT SELECT ON public.v_store_invoice_activity TO authenticated;

CREATE OR REPLACE FUNCTION public.refresh_store_intelligence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal_analytics.store_intelligence_v;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_store_invoice_activity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal_analytics.store_invoice_activity;
EXCEPTION WHEN OTHERS THEN
  REFRESH MATERIALIZED VIEW internal_analytics.store_invoice_activity;
END;
$function$;