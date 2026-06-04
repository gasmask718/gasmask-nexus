-- Public-safe GasMask store locator view
-- Whitelisted columns only: name, neighborhood, city, street, lat, lng
-- HARD EXCLUDES: phones, contacts, owners, orders, internals, prospects, inactive, deleted

CREATE OR REPLACE VIEW public.v_public_store_locator
WITH (security_invoker = true) AS
SELECT
  sm.id AS store_id,
  sm.store_name,
  COALESCE(s.neighborhood, b.name) AS neighborhood,
  s.address_city AS city,
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

-- Grant SELECT to anon on the VIEW only. Base tables (store_master, stores) remain RLS-locked.
GRANT SELECT ON public.v_public_store_locator TO anon;
GRANT SELECT ON public.v_public_store_locator TO authenticated;

COMMENT ON VIEW public.v_public_store_locator IS
  'Public-safe store locator. Anon-readable. Whitelisted columns only (name, neighborhood, city, street, lat, lng). Active, geocoded, non-deleted, non-simulation stores only. Built for the GasMask public site.';