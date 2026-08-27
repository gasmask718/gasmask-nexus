GRANT SELECT (id) ON public.dd_catalog_drafts TO authenticated;
REVOKE SELECT ON public.dd_admin_catalog_drafts FROM anon;
REVOKE SELECT ON public.dd_wholesaler_drafts_safe FROM anon;
REVOKE SELECT ON public.v_wholesaler_pick_slip FROM anon;