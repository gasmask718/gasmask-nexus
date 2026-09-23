REVOKE EXECUTE ON FUNCTION public.ambassador_visible_store_geography() FROM anon;
REVOKE EXECUTE ON FUNCTION public.ambassador_visible_store_geography() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ambassador_visible_store_geography() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ambassador_visible_store_geography() TO service_role;