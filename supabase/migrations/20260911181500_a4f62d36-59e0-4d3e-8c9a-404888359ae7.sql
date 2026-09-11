REVOKE SELECT ON public.ambassador_store_claims FROM authenticated;

DROP POLICY IF EXISTS "Field users view claims for visible stores" ON public.ambassador_store_claims;

CREATE INDEX IF NOT EXISTS ambassador_territory_coverage_ambassador_id_idx
  ON public.ambassador_territory_coverage (ambassador_id);

CREATE INDEX IF NOT EXISTS ambassador_assignments_ambassador_store_active_idx
  ON public.ambassador_assignments (ambassador_id, store_id)
  WHERE active IS TRUE AND unassigned_at IS NULL;

CREATE INDEX IF NOT EXISTS route_stops_store_id_route_id_idx
  ON public.route_stops (store_id, route_id);

CREATE INDEX IF NOT EXISTS routes_assigned_to_date_idx
  ON public.routes (assigned_to, date);

REVOKE ALL ON FUNCTION public.normalize_us_state(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.territory_matches_store(text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ambassador_has_store_access(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ambassador_visible_store_ids_for_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_field_store_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.field_worker_has_store(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ambassador_visible_stores() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ambassador_store_claim_status(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.secure_store_for_ambassador(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.normalize_us_state(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.territory_matches_store(text, text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ambassador_has_store_access(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ambassador_visible_store_ids_for_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.my_field_store_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.field_worker_has_store(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ambassador_visible_stores() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ambassador_store_claim_status(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.secure_store_for_ambassador(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.field_worker_has_store(uuid, uuid) IS 'Field access includes approved shared territory visibility so ambassadors in the same area can contact visible stores. Assignments, routes, visits, and communications do not secure a store; only secure_store_for_ambassador creates a claim.';