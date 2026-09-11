REVOKE ALL ON FUNCTION public.normalize_us_state(text) FROM anon;
REVOKE ALL ON FUNCTION public.territory_matches_store(text, text, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.ambassador_has_store_access(uuid, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.ambassador_visible_store_ids_for_user(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.my_field_store_ids() FROM anon;
REVOKE ALL ON FUNCTION public.field_worker_has_store(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.ambassador_visible_stores() FROM anon;
REVOKE ALL ON FUNCTION public.ambassador_store_claim_status(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.secure_store_for_ambassador(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.normalize_us_state(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.territory_matches_store(text, text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ambassador_has_store_access(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ambassador_visible_store_ids_for_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.my_field_store_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.field_worker_has_store(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ambassador_visible_stores() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ambassador_store_claim_status(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.secure_store_for_ambassador(uuid) TO authenticated, service_role;