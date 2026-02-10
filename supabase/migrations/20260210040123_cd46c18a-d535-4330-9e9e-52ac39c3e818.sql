
-- Explicitly set SECURITY INVOKER on the three new territory views
-- to ensure they always respect the querying user's RLS policies.
ALTER VIEW public.v_territory_neighborhood_kpis SET (security_invoker = on);
ALTER VIEW public.v_territory_address_status_summary SET (security_invoker = on);
ALTER VIEW public.v_territory_domination_score SET (security_invoker = on);
