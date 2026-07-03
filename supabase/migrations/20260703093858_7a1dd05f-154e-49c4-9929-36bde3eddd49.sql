ALTER VIEW public.dc_unified_leads SET (security_invoker = false);

GRANT SELECT ON public.dc_unified_leads TO authenticated;
GRANT ALL ON public.dc_unified_leads TO service_role;

NOTIFY pgrst, 'reload schema';