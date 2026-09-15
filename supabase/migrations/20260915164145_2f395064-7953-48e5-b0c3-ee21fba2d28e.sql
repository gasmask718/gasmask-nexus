INSERT INTO public.ambassador_territory_coverage (ambassador_id, region_type, region_value, is_primary)
SELECT 'f2ae6ea4-65d4-4cbf-9b63-cc1ed20eae36'::uuid, 'zip'::territory_region_type, z, false
FROM (VALUES ('11691'),('11692'),('11693'),('11694')) AS v(z)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ambassador_territory_coverage tc
  WHERE tc.ambassador_id = 'f2ae6ea4-65d4-4cbf-9b63-cc1ed20eae36'::uuid
    AND tc.region_type = 'zip'::territory_region_type
    AND tc.region_value = v.z
);