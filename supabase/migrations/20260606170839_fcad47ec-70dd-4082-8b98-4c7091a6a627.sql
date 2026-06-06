-- Geographic router for DD checkout (read-only RPC)
CREATE OR REPLACE FUNCTION public.dd_pick_supplier_for_item(
  p_product_id uuid,
  p_qty integer,
  p_ship_state text,
  p_ship_lat double precision,
  p_ship_lng double precision
)
RETURNS TABLE (
  wholesaler_id uuid,
  routing_reason text,
  routing_details jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state text := upper(coalesce(p_ship_state, ''));
  v_wid uuid;
  v_dist double precision;
  v_home_wid uuid;
BEGIN
  -- 1. Per-order pin is applied later (in checkout) on the order row itself.
  --    Per-product pin overrides geography:
  SELECT pinned_wholesaler_id INTO v_wid
  FROM dd_routing_pins p
  JOIN wholesaler_profiles w ON w.id = p.pinned_wholesaler_id
  WHERE p.pin_type = 'product'
    AND p.product_id = p_product_id
    AND coalesce(w.routing_paused, false) = false
  LIMIT 1;
  IF v_wid IS NOT NULL THEN
    RETURN QUERY SELECT v_wid, 'pin_product'::text,
      jsonb_build_object('rule', 'product_pin');
    RETURN;
  END IF;

  -- 2. Per-state pin
  IF v_state <> '' THEN
    SELECT pinned_wholesaler_id INTO v_wid
    FROM dd_routing_pins p
    JOIN wholesaler_profiles w ON w.id = p.pinned_wholesaler_id
    WHERE p.pin_type = 'state'
      AND p.state_code = v_state
      AND coalesce(w.routing_paused, false) = false
    LIMIT 1;
    IF v_wid IS NOT NULL THEN
      RETURN QUERY SELECT v_wid, 'pin_state'::text,
        jsonb_build_object('rule', 'state_pin', 'state', v_state);
      RETURN;
    END IF;
  END IF;

  -- 3. In-state supplier with stock (highest priority_weight wins)
  IF v_state <> '' THEN
    SELECT w.id INTO v_wid
    FROM wholesaler_profiles w
    JOIN marketplace_inventory i ON i.wholesaler_id = w.id AND i.product_id = p_product_id
    WHERE coalesce(w.routing_paused, false) = false
      AND upper(coalesce(w.warehouse_state, '')) = v_state
      AND (i.quantity_available - coalesce(i.reserved_quantity, 0)) >= p_qty
    ORDER BY coalesce(w.priority_weight, 50) DESC, w.id
    LIMIT 1;
    IF v_wid IS NOT NULL THEN
      RETURN QUERY SELECT v_wid, 'in_state'::text,
        jsonb_build_object('rule', 'in_state', 'state', v_state);
      RETURN;
    END IF;
  END IF;

  -- 4. Nearest supplier with stock (Haversine; weighted by priority_weight)
  IF p_ship_lat IS NOT NULL AND p_ship_lng IS NOT NULL THEN
    WITH candidates AS (
      SELECT
        w.id,
        w.company_name,
        w.warehouse_state,
        coalesce(w.priority_weight, 50) AS weight,
        3958.8 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(p_ship_lat)) * cos(radians(w.warehouse_lat)) *
            cos(radians(w.warehouse_lng) - radians(p_ship_lng)) +
            sin(radians(p_ship_lat)) * sin(radians(w.warehouse_lat))
          ))
        ) AS miles
      FROM wholesaler_profiles w
      JOIN marketplace_inventory i ON i.wholesaler_id = w.id AND i.product_id = p_product_id
      WHERE coalesce(w.routing_paused, false) = false
        AND w.warehouse_lat IS NOT NULL
        AND w.warehouse_lng IS NOT NULL
        AND (i.quantity_available - coalesce(i.reserved_quantity, 0)) >= p_qty
    )
    SELECT id, miles INTO v_wid, v_dist
    FROM candidates
    -- weight nudge: each priority point shaves ~2 miles of effective distance
    ORDER BY (miles - (weight * 2.0)) ASC, miles ASC
    LIMIT 1;
    IF v_wid IS NOT NULL THEN
      RETURN QUERY SELECT v_wid, 'nearest'::text,
        jsonb_build_object('rule', 'nearest', 'miles', round(v_dist::numeric, 1));
      RETURN;
    END IF;
  END IF;

  -- 5. Default supplier (must have stock; ignore distance)
  SELECT w.id INTO v_wid
  FROM wholesaler_profiles w
  LEFT JOIN marketplace_inventory i
    ON i.wholesaler_id = w.id AND i.product_id = p_product_id
  WHERE coalesce(w.routing_paused, false) = false
    AND coalesce(w.is_default_supplier, false) = true
    AND (i.id IS NULL OR (i.quantity_available - coalesce(i.reserved_quantity, 0)) >= p_qty)
  ORDER BY (i.id IS NOT NULL) DESC, coalesce(w.priority_weight, 50) DESC
  LIMIT 1;
  IF v_wid IS NOT NULL THEN
    RETURN QUERY SELECT v_wid, 'default'::text,
      jsonb_build_object('rule', 'default_supplier');
    RETURN;
  END IF;

  -- 6. Last resort: product's home wholesaler (legacy product.wholesaler_id)
  SELECT p.wholesaler_id INTO v_home_wid
  FROM products_all p
  WHERE p.id = p_product_id;
  IF v_home_wid IS NOT NULL THEN
    RETURN QUERY SELECT v_home_wid, 'fallback_home'::text,
      jsonb_build_object('rule', 'product_home_supplier');
    RETURN;
  END IF;

  RETURN QUERY SELECT NULL::uuid, 'unrouted'::text,
    jsonb_build_object('rule', 'none', 'note', 'no supplier with stock');
END;
$$;

GRANT EXECUTE ON FUNCTION public.dd_pick_supplier_for_item(uuid, integer, text, double precision, double precision) TO authenticated, service_role;