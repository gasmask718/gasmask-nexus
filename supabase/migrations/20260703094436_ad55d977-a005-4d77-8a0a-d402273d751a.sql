GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE public.dc_unified_leads TO authenticated;
GRANT ALL ON TABLE public.dc_unified_leads TO service_role;
REVOKE ALL ON TABLE public.dc_unified_leads FROM anon;

ALTER VIEW public.dc_unified_leads SET (security_invoker = false);

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';