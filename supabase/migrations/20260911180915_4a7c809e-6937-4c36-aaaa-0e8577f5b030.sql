REVOKE ALL ON FUNCTION public.normalize_us_state(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.territory_matches_store(text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ambassador_has_store_access(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ambassador_visible_store_ids_for_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ambassador_visible_stores() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ambassador_store_claim_status(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.secure_store_for_ambassador(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_field_store_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.field_worker_has_store(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.normalize_us_state(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.territory_matches_store(text, text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ambassador_has_store_access(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ambassador_visible_store_ids_for_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ambassador_visible_stores() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ambassador_store_claim_status(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.secure_store_for_ambassador(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_field_store_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.field_worker_has_store(uuid, uuid) TO authenticated, service_role;

DROP POLICY "Authenticated users can view store claim status" ON public.ambassador_store_claims;
CREATE POLICY "Field users view claims for visible stores"
ON public.ambassador_store_claims
FOR SELECT
TO authenticated
USING (public.field_worker_has_store(auth.uid(), store_id));

CREATE OR REPLACE FUNCTION public.touch_ambassador_store_claim()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.touch_ambassador_store_claim() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_ambassador_store_claim() TO service_role;

CREATE TRIGGER ambassador_store_claims_touch_updated_at
BEFORE UPDATE ON public.ambassador_store_claims
FOR EACH ROW EXECUTE FUNCTION public.touch_ambassador_store_claim();

INSERT INTO public.ambassador_territory_coverage (
  ambassador_id, region_type, region_value, is_primary, updated_by
)
SELECT
  a.id, 'city'::public.territory_region_type, 'Queens, NY', true,
  '6019a316-2d95-4662-997c-c47bd0b37697'::uuid
FROM public.ambassadors a
WHERE a.id = '21506f4c-c840-487d-9b98-9b93c1943d6c'::uuid
  AND a.is_active IS TRUE
  AND lower(trim(a.email)) = lower('Oliverferminvalenzuela@gmail.com')
ON CONFLICT (ambassador_id, region_type, region_value)
DO UPDATE SET is_primary = EXCLUDED.is_primary,
              updated_by = EXCLUDED.updated_by,
              updated_at = now();