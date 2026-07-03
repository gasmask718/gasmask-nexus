-- Ensure dc_unified_leads view is accessible to authenticated users with full row visibility.
-- Owner (postgres, bypassrls) executes the view under security_invoker=false so all UNION branches
-- return regardless of the caller's per-table RLS. Re-grant + refresh PostgREST schema cache to
-- clear any stale state that was scoping the Lead Inbox to only TopTier (244) rows.

ALTER VIEW public.dc_unified_leads SET (security_invoker = false);

GRANT SELECT ON public.dc_unified_leads TO authenticated;
GRANT SELECT ON public.dc_unified_leads TO service_role;

NOTIFY pgrst, 'reload schema';