CREATE OR REPLACE FUNCTION public.get_public_store_locator()
RETURNS TABLE (
  store_id uuid,
  store_name text,
  neighborhood text,
  city text,
  street text,
  lat double precision,
  lng double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sm.id AS store_id,
         sm.store_name,
         COALESCE(s.neighborhood, b.name) AS neighborhood,
         s.address_city  AS city,
         s.address_street AS street,
         s.lat,
         s.lng
    FROM public.store_master sm
    JOIN public.stores s ON s.id = sm.id
    LEFT JOIN public.boroughs b ON b.id = sm.borough_id
   WHERE sm.deleted_at IS NULL
     AND s.deleted_at IS NULL
     AND sm.status = 'active'
     AND COALESCE(s.is_simulation, false) = false
     AND COALESCE(s.is_test_data, false) = false
     AND s.lat IS NOT NULL
     AND s.lng IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_public_store_locator() FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_store_locator() TO anon, authenticated;