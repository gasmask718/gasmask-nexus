
CREATE OR REPLACE FUNCTION public.dd_update_product_pricing(
  p_product_id uuid,
  p_supplier_cost numeric DEFAULT NULL,
  p_store_price_a numeric DEFAULT NULL,
  p_dtc_price_b numeric DEFAULT NULL,
  p_map_price numeric DEFAULT NULL,
  p_allow_override boolean DEFAULT false
)
RETURNS SETOF public.products_all
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_allow_override THEN
    PERFORM set_config('app.allow_below_floor', 'true', true);
  END IF;

  RETURN QUERY
  UPDATE public.products_all
     SET supplier_cost = COALESCE(p_supplier_cost, supplier_cost),
         store_price_a = COALESCE(p_store_price_a, store_price_a),
         dtc_price_b   = COALESCE(p_dtc_price_b,   dtc_price_b),
         map_price     = COALESCE(p_map_price,     map_price)
   WHERE id = p_product_id
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dd_update_product_pricing(uuid, numeric, numeric, numeric, numeric, boolean) TO authenticated, service_role;
