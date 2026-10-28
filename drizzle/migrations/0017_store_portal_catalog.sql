-- Read-only catalog for the store portal: active GasMask-family products with store prices (per unit; a box = 100 units)
CREATE OR REPLACE FUNCTION public.store_portal_catalog()
RETURNS TABLE(product_id uuid, name text, brand text, unit_price numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.name, b.name, p.store_price
  FROM public.products p JOIN public.brands b ON b.id = p.brand_id
  WHERE auth.uid() IS NOT NULL
    AND (public.has_role(auth.uid(), 'store'::public.app_role) OR public.is_staff(auth.uid()))
    AND coalesce(p.is_active, true) AND p.store_price IS NOT NULL AND p.store_price > 0
    AND b.name IN ('GasMask','Hot Mama','Grabba R Us','Hotscolatti')
  ORDER BY CASE b.name WHEN 'GasMask' THEN 0 WHEN 'Hot Mama' THEN 1 WHEN 'Hotscolatti' THEN 2 ELSE 3 END, p.name
$$;
REVOKE EXECUTE ON FUNCTION public.store_portal_catalog() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_portal_catalog() TO authenticated;