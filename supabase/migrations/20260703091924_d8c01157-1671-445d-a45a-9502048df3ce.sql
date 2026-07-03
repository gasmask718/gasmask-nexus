-- Fix dc_unified_leads visibility: it was security_invoker so RLS on 6 underlying tables hid rows.
-- Only top_tier (crm_partners) was readable by authenticated users, so the Lead Inbox showed 244/3631.
-- Switch to security_definer (view runs with owner privileges) so admins see all leads across business units.
-- Access is still gated: only authenticated role can select the view, anon is blocked.

ALTER VIEW public.dc_unified_leads SET (security_invoker = false);

REVOKE ALL ON public.dc_unified_leads FROM anon;
GRANT SELECT ON public.dc_unified_leads TO authenticated;
GRANT ALL ON public.dc_unified_leads TO service_role;