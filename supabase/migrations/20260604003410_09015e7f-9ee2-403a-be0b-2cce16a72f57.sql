
-- enforce single routing row per order
DELETE FROM public.order_routing a USING public.order_routing b
 WHERE a.ctid < b.ctid AND a.order_id = b.order_id;
CREATE UNIQUE INDEX IF NOT EXISTS order_routing_order_id_uq ON public.order_routing(order_id);

-- replace the upsert logic with a proper one
CREATE OR REPLACE FUNCTION public.route_order_to_supplier(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.marketplace_orders%ROWTYPE;
  v_ship_state text;
  v_ship_lat numeric;
  v_ship_lng numeric;
  v_item RECORD;
  v_chosen_w uuid;
  v_reason text;
  v_candidates jsonb;
  v_per_item jsonb := '[]'::jsonb;
  v_primary_w uuid;
BEGIN
  SELECT * INTO v_order FROM public.marketplace_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

  v_ship_state := UPPER(COALESCE(v_order.shipping_address->>'state', ''));
  v_ship_lat := NULLIF(v_order.shipping_address->>'lat','')::numeric;
  v_ship_lng := NULLIF(v_order.shipping_address->>'lng','')::numeric;

  FOR v_item IN
    SELECT id, product_id, qty FROM public.marketplace_order_items WHERE order_id = p_order_id
  LOOP
    v_chosen_w := NULL; v_reason := NULL; v_candidates := '[]'::jsonb;

    WITH cands AS (
      SELECT wp.id AS wholesaler_id, wp.company_name, wp.warehouse_state,
             wp.priority_weight, wp.is_default_supplier,
             mi.quantity_available - mi.reserved_quantity AS available,
             wp.warehouse_lat, wp.warehouse_lng,
             CASE WHEN v_ship_lat IS NOT NULL AND wp.warehouse_lat IS NOT NULL
                  THEN 3959 * acos(LEAST(1.0, GREATEST(-1.0,
                       cos(radians(v_ship_lat)) * cos(radians(wp.warehouse_lat))
                       * cos(radians(wp.warehouse_lng) - radians(v_ship_lng))
                       + sin(radians(v_ship_lat)) * sin(radians(wp.warehouse_lat)))))
                  ELSE NULL END AS distance_mi
      FROM public.marketplace_inventory mi
      JOIN public.wholesaler_profiles wp ON wp.id = mi.wholesaler_id
      WHERE mi.product_id = v_item.product_id
        AND (mi.quantity_available - mi.reserved_quantity) >= v_item.qty
        AND COALESCE(wp.routing_paused,false) = false
    )
    SELECT COALESCE(jsonb_agg(to_jsonb(cands.*) ORDER BY priority_weight DESC), '[]'::jsonb)
    INTO v_candidates FROM cands;

    SELECT pinned_wholesaler_id INTO v_chosen_w FROM public.dd_routing_pins
     WHERE pin_type='order' AND order_id = p_order_id LIMIT 1;
    IF v_chosen_w IS NOT NULL THEN v_reason := 'manual_pin'; END IF;

    IF v_chosen_w IS NULL THEN
      SELECT p.pinned_wholesaler_id INTO v_chosen_w FROM public.dd_routing_pins p
       WHERE p.pin_type='product' AND p.product_id = v_item.product_id
         AND EXISTS (SELECT 1 FROM public.marketplace_inventory mi2
                     JOIN public.wholesaler_profiles wp2 ON wp2.id=mi2.wholesaler_id
                     WHERE mi2.wholesaler_id = p.pinned_wholesaler_id
                       AND mi2.product_id = v_item.product_id
                       AND (mi2.quantity_available - mi2.reserved_quantity) >= v_item.qty
                       AND COALESCE(wp2.routing_paused,false)=false) LIMIT 1;
      IF v_chosen_w IS NOT NULL THEN v_reason := 'manual_pin'; END IF;
    END IF;

    IF v_chosen_w IS NULL AND v_ship_state <> '' THEN
      SELECT p.pinned_wholesaler_id INTO v_chosen_w FROM public.dd_routing_pins p
       WHERE p.pin_type='state' AND p.state_code = v_ship_state
         AND EXISTS (SELECT 1 FROM public.marketplace_inventory mi2
                     JOIN public.wholesaler_profiles wp2 ON wp2.id=mi2.wholesaler_id
                     WHERE mi2.wholesaler_id = p.pinned_wholesaler_id
                       AND mi2.product_id = v_item.product_id
                       AND (mi2.quantity_available - mi2.reserved_quantity) >= v_item.qty
                       AND COALESCE(wp2.routing_paused,false)=false) LIMIT 1;
      IF v_chosen_w IS NOT NULL THEN v_reason := 'manual_pin'; END IF;
    END IF;

    IF v_chosen_w IS NULL AND v_ship_state <> '' THEN
      SELECT wholesaler_id INTO v_chosen_w
      FROM jsonb_to_recordset(v_candidates) AS c(
        wholesaler_id uuid, warehouse_state text, priority_weight int,
        distance_mi numeric, is_default_supplier boolean)
      WHERE UPPER(COALESCE(warehouse_state,''))=v_ship_state
      ORDER BY priority_weight DESC NULLS LAST, distance_mi NULLS LAST LIMIT 1;
      IF v_chosen_w IS NOT NULL THEN v_reason := 'in_state'; END IF;
    END IF;

    IF v_chosen_w IS NULL THEN
      SELECT wholesaler_id INTO v_chosen_w
      FROM jsonb_to_recordset(v_candidates) AS c(
        wholesaler_id uuid, warehouse_state text, priority_weight int,
        distance_mi numeric, is_default_supplier boolean)
      WHERE COALESCE(priority_weight,50) > 50
      ORDER BY priority_weight DESC NULLS LAST, distance_mi NULLS LAST LIMIT 1;
      IF v_chosen_w IS NOT NULL THEN v_reason := 'weighted'; END IF;
    END IF;

    IF v_chosen_w IS NULL THEN
      SELECT wholesaler_id INTO v_chosen_w
      FROM jsonb_to_recordset(v_candidates) AS c(
        wholesaler_id uuid, warehouse_state text, priority_weight int,
        distance_mi numeric, is_default_supplier boolean)
      WHERE distance_mi IS NOT NULL ORDER BY distance_mi ASC LIMIT 1;
      IF v_chosen_w IS NOT NULL THEN v_reason := 'nearest'; END IF;
    END IF;

    IF v_chosen_w IS NULL THEN
      SELECT wholesaler_id INTO v_chosen_w
      FROM jsonb_to_recordset(v_candidates) AS c(
        wholesaler_id uuid, warehouse_state text, priority_weight int,
        distance_mi numeric, is_default_supplier boolean)
      ORDER BY is_default_supplier DESC, priority_weight DESC LIMIT 1;
      IF v_chosen_w IS NOT NULL THEN v_reason := 'default'; END IF;
    END IF;

    v_per_item := v_per_item || jsonb_build_object(
      'item_id', v_item.id, 'product_id', v_item.product_id, 'qty', v_item.qty,
      'chosen_wholesaler_id', v_chosen_w, 'reason', v_reason, 'candidates', v_candidates);

    IF v_chosen_w IS NOT NULL THEN
      UPDATE public.marketplace_order_items SET wholesaler_id = v_chosen_w WHERE id = v_item.id;
    END IF;
  END LOOP;

  v_primary_w := (v_per_item->0->>'chosen_wholesaler_id')::uuid;

  INSERT INTO public.order_routing (order_id, assigned_wholesaler_id, routing_reason, routing_details, status)
  VALUES (p_order_id, v_primary_w, v_per_item->0->>'reason',
          jsonb_build_object('items', v_per_item, 'routed_at', now()), 'pending')
  ON CONFLICT (order_id) DO UPDATE
    SET assigned_wholesaler_id = EXCLUDED.assigned_wholesaler_id,
        routing_reason = EXCLUDED.routing_reason,
        routing_details = EXCLUDED.routing_details;

  DELETE FROM public.marketplace_fulfillments mf
   WHERE mf.order_id = p_order_id AND mf.status = 'pending'
     AND mf.wholesaler_id NOT IN (
       SELECT DISTINCT wholesaler_id FROM public.marketplace_order_items
       WHERE order_id = p_order_id AND wholesaler_id IS NOT NULL);

  INSERT INTO public.marketplace_fulfillments (order_id, wholesaler_id, status, items_snapshot, shipping_mode)
  SELECT p_order_id, oi.wholesaler_id, 'pending',
         jsonb_agg(jsonb_build_object('product_id', oi.product_id, 'qty', oi.qty, 'price_each', oi.price_each)),
         'sandbox'
  FROM public.marketplace_order_items oi
  WHERE oi.order_id = p_order_id AND oi.wholesaler_id IS NOT NULL
  GROUP BY oi.wholesaler_id
  ON CONFLICT (order_id, wholesaler_id) DO NOTHING;

  INSERT INTO public.dd_routing_audit (event_type, order_id, wholesaler_id, new_value, reason, actor)
  VALUES ('route_decision', p_order_id, v_primary_w,
          jsonb_build_object('items', v_per_item), v_per_item->0->>'reason', auth.uid());

  RETURN jsonb_build_object('order_id', p_order_id, 'primary', v_primary_w, 'items', v_per_item);
END;
$$;
