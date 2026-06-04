
-- ════════════════════════════════════════════════════════════════════
-- DD SPRINT 5: NETWORK BRAIN
-- ════════════════════════════════════════════════════════════════════

-- 1. WHOLESALER ROUTING CONTROLS ──────────────────────────────────────
ALTER TABLE public.wholesaler_profiles
  ADD COLUMN IF NOT EXISTS priority_weight integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS routing_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_default_supplier boolean NOT NULL DEFAULT false;

-- 2. ORDER_ROUTING REASON + DETAILS ───────────────────────────────────
ALTER TABLE public.order_routing
  ADD COLUMN IF NOT EXISTS routing_reason text,
  ADD COLUMN IF NOT EXISTS routing_details jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS manual_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS override_by uuid,
  ADD COLUMN IF NOT EXISTS override_reason text,
  ADD COLUMN IF NOT EXISTS override_at timestamptz;

-- 3. PRODUCT & STATE PIN OVERRIDES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dd_routing_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_type text NOT NULL CHECK (pin_type IN ('product','state','order')),
  product_id uuid REFERENCES public.products_all(id) ON DELETE CASCADE,
  state_code text,
  order_id uuid REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  pinned_wholesaler_id uuid NOT NULL REFERENCES public.wholesaler_profiles(id) ON DELETE CASCADE,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (pin_type='product' AND product_id IS NOT NULL) OR
    (pin_type='state'   AND state_code IS NOT NULL) OR
    (pin_type='order'   AND order_id   IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS dd_pins_product_uq ON public.dd_routing_pins(product_id) WHERE pin_type='product';
CREATE UNIQUE INDEX IF NOT EXISTS dd_pins_state_uq   ON public.dd_routing_pins(state_code) WHERE pin_type='state';
CREATE UNIQUE INDEX IF NOT EXISTS dd_pins_order_uq   ON public.dd_routing_pins(order_id)   WHERE pin_type='order';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_routing_pins TO authenticated;
GRANT ALL ON public.dd_routing_pins TO service_role;
ALTER TABLE public.dd_routing_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage dd routing pins" ON public.dd_routing_pins
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

-- 4. ROUTING AUDIT LOG ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dd_routing_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,             -- 'route_decision','manual_override','weight_change','pause','pin','reroute_stockout'
  order_id uuid,
  wholesaler_id uuid,
  prev_value jsonb,
  new_value jsonb,
  reason text,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dd_routing_audit_created_idx ON public.dd_routing_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS dd_routing_audit_order_idx ON public.dd_routing_audit(order_id);
GRANT SELECT, INSERT ON public.dd_routing_audit TO authenticated;
GRANT ALL ON public.dd_routing_audit TO service_role;
ALTER TABLE public.dd_routing_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view routing audit" ON public.dd_routing_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));
CREATE POLICY "System insert routing audit" ON public.dd_routing_audit FOR INSERT TO authenticated WITH CHECK (true);

-- 5. WHOLESALER ↔ STORE_MASTER LINK (Grabba Bridge) ───────────────────
CREATE TABLE IF NOT EXISTS public.dd_wholesaler_store_link (
  wholesaler_id uuid PRIMARY KEY REFERENCES public.wholesaler_profiles(id) ON DELETE CASCADE,
  store_master_id uuid NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_wholesaler_store_link TO authenticated;
GRANT ALL ON public.dd_wholesaler_store_link TO service_role;
ALTER TABLE public.dd_wholesaler_store_link ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins + owning wholesaler view link" ON public.dd_wholesaler_store_link FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner')
    OR wholesaler_id IN (SELECT id FROM public.wholesaler_profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "Service manages link" ON public.dd_wholesaler_store_link FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

-- ════════════════════════════════════════════════════════════════════
-- 6. CORE RPC: route_order_to_supplier
-- ════════════════════════════════════════════════════════════════════
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
  v_cand RECORD;
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

  -- iterate items
  FOR v_item IN
    SELECT id, product_id, qty FROM public.marketplace_order_items WHERE order_id = p_order_id
  LOOP
    v_chosen_w := NULL;
    v_reason := NULL;
    v_candidates := '[]'::jsonb;

    -- gather candidates: have inventory, not paused
    WITH cands AS (
      SELECT
        wp.id AS wholesaler_id,
        wp.company_name,
        wp.warehouse_state,
        wp.priority_weight,
        wp.is_default_supplier,
        mi.quantity_available - mi.reserved_quantity AS available,
        wp.warehouse_lat, wp.warehouse_lng,
        CASE WHEN v_ship_lat IS NOT NULL AND wp.warehouse_lat IS NOT NULL
             THEN 3959 * acos(
                LEAST(1.0, GREATEST(-1.0,
                  cos(radians(v_ship_lat)) * cos(radians(wp.warehouse_lat))
                  * cos(radians(wp.warehouse_lng) - radians(v_ship_lng))
                  + sin(radians(v_ship_lat)) * sin(radians(wp.warehouse_lat))
                ))
             ) ELSE NULL END AS distance_mi
      FROM public.marketplace_inventory mi
      JOIN public.wholesaler_profiles wp ON wp.id = mi.wholesaler_id
      WHERE mi.product_id = v_item.product_id
        AND (mi.quantity_available - mi.reserved_quantity) >= v_item.qty
        AND COALESCE(wp.routing_paused,false) = false
    )
    SELECT COALESCE(jsonb_agg(to_jsonb(cands.*) ORDER BY priority_weight DESC), '[]'::jsonb)
    INTO v_candidates FROM cands;

    -- a. order-level manual pin?
    SELECT pinned_wholesaler_id INTO v_chosen_w
      FROM public.dd_routing_pins
     WHERE pin_type='order' AND order_id = p_order_id LIMIT 1;
    IF v_chosen_w IS NOT NULL THEN v_reason := 'manual_pin'; END IF;

    -- a2. per-product pin
    IF v_chosen_w IS NULL THEN
      SELECT p.pinned_wholesaler_id INTO v_chosen_w
        FROM public.dd_routing_pins p
       WHERE p.pin_type='product' AND p.product_id = v_item.product_id
         AND EXISTS (
           SELECT 1 FROM public.marketplace_inventory mi2
           JOIN public.wholesaler_profiles wp2 ON wp2.id = mi2.wholesaler_id
           WHERE mi2.wholesaler_id = p.pinned_wholesaler_id
             AND mi2.product_id = v_item.product_id
             AND (mi2.quantity_available - mi2.reserved_quantity) >= v_item.qty
             AND COALESCE(wp2.routing_paused,false) = false
         ) LIMIT 1;
      IF v_chosen_w IS NOT NULL THEN v_reason := 'manual_pin'; END IF;
    END IF;

    -- a3. per-state preferred
    IF v_chosen_w IS NULL AND v_ship_state <> '' THEN
      SELECT p.pinned_wholesaler_id INTO v_chosen_w
        FROM public.dd_routing_pins p
       WHERE p.pin_type='state' AND p.state_code = v_ship_state
         AND EXISTS (
           SELECT 1 FROM public.marketplace_inventory mi2
           JOIN public.wholesaler_profiles wp2 ON wp2.id = mi2.wholesaler_id
           WHERE mi2.wholesaler_id = p.pinned_wholesaler_id
             AND mi2.product_id = v_item.product_id
             AND (mi2.quantity_available - mi2.reserved_quantity) >= v_item.qty
             AND COALESCE(wp2.routing_paused,false) = false
         ) LIMIT 1;
      IF v_chosen_w IS NOT NULL THEN v_reason := 'manual_pin'; END IF;
    END IF;

    -- b. in-state highest weight
    IF v_chosen_w IS NULL AND v_ship_state <> '' THEN
      SELECT wholesaler_id INTO v_chosen_w
      FROM jsonb_to_recordset(v_candidates) AS c(
        wholesaler_id uuid, warehouse_state text, priority_weight int,
        distance_mi numeric, is_default_supplier boolean
      )
      WHERE UPPER(COALESCE(warehouse_state,'')) = v_ship_state
      ORDER BY priority_weight DESC NULLS LAST, distance_mi NULLS LAST
      LIMIT 1;
      IF v_chosen_w IS NOT NULL THEN v_reason := 'in_state'; END IF;
    END IF;

    -- c. highest weight (>50 considered "weighted")
    IF v_chosen_w IS NULL THEN
      SELECT wholesaler_id INTO v_chosen_w
      FROM jsonb_to_recordset(v_candidates) AS c(
        wholesaler_id uuid, warehouse_state text, priority_weight int,
        distance_mi numeric, is_default_supplier boolean
      )
      WHERE COALESCE(priority_weight,50) > 50
      ORDER BY priority_weight DESC NULLS LAST, distance_mi NULLS LAST
      LIMIT 1;
      IF v_chosen_w IS NOT NULL THEN v_reason := 'weighted'; END IF;
    END IF;

    -- d. nearest
    IF v_chosen_w IS NULL THEN
      SELECT wholesaler_id INTO v_chosen_w
      FROM jsonb_to_recordset(v_candidates) AS c(
        wholesaler_id uuid, warehouse_state text, priority_weight int,
        distance_mi numeric, is_default_supplier boolean
      )
      WHERE distance_mi IS NOT NULL
      ORDER BY distance_mi ASC LIMIT 1;
      IF v_chosen_w IS NOT NULL THEN v_reason := 'nearest'; END IF;
    END IF;

    -- e. default fallback or first available
    IF v_chosen_w IS NULL THEN
      SELECT wholesaler_id INTO v_chosen_w
      FROM jsonb_to_recordset(v_candidates) AS c(
        wholesaler_id uuid, warehouse_state text, priority_weight int,
        distance_mi numeric, is_default_supplier boolean
      )
      ORDER BY is_default_supplier DESC, priority_weight DESC LIMIT 1;
      IF v_chosen_w IS NOT NULL THEN v_reason := 'default'; END IF;
    END IF;

    v_per_item := v_per_item || jsonb_build_object(
      'item_id', v_item.id,
      'product_id', v_item.product_id,
      'qty', v_item.qty,
      'chosen_wholesaler_id', v_chosen_w,
      'reason', v_reason,
      'candidates', v_candidates
    );

    -- update item's wholesaler_id (re-point) if changed
    IF v_chosen_w IS NOT NULL THEN
      UPDATE public.marketplace_order_items
         SET wholesaler_id = v_chosen_w
       WHERE id = v_item.id;
    END IF;
  END LOOP;

  -- pick primary supplier = first item's chosen
  v_primary_w := (v_per_item->0->>'chosen_wholesaler_id')::uuid;

  -- upsert order_routing
  INSERT INTO public.order_routing (order_id, assigned_wholesaler_id, routing_reason, routing_details, status)
  VALUES (
    p_order_id, v_primary_w,
    v_per_item->0->>'reason',
    jsonb_build_object('items', v_per_item, 'routed_at', now()),
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;

  -- if a row already existed, update it
  UPDATE public.order_routing
     SET assigned_wholesaler_id = v_primary_w,
         routing_reason = v_per_item->0->>'reason',
         routing_details = jsonb_build_object('items', v_per_item, 'routed_at', now())
   WHERE order_id = p_order_id;

  -- re-point fulfillments that aren't shipped yet:
  -- delete fulfillments whose wholesaler is no longer used by any item; ensure one per chosen wholesaler.
  DELETE FROM public.marketplace_fulfillments mf
   WHERE mf.order_id = p_order_id
     AND mf.status IN ('pending')
     AND mf.wholesaler_id NOT IN (
       SELECT DISTINCT wholesaler_id FROM public.marketplace_order_items
       WHERE order_id = p_order_id AND wholesaler_id IS NOT NULL
     );

  INSERT INTO public.marketplace_fulfillments (order_id, wholesaler_id, status, items_snapshot, shipping_mode)
  SELECT p_order_id, oi.wholesaler_id, 'pending',
         jsonb_agg(jsonb_build_object(
           'product_id', oi.product_id, 'qty', oi.qty, 'price_each', oi.price_each
         )),
         'sandbox'
  FROM public.marketplace_order_items oi
  WHERE oi.order_id = p_order_id AND oi.wholesaler_id IS NOT NULL
  GROUP BY oi.wholesaler_id
  ON CONFLICT (order_id, wholesaler_id) DO NOTHING;

  -- audit
  INSERT INTO public.dd_routing_audit (event_type, order_id, wholesaler_id, new_value, reason, actor)
  VALUES ('route_decision', p_order_id, v_primary_w,
          jsonb_build_object('items', v_per_item),
          v_per_item->0->>'reason', auth.uid());

  RETURN jsonb_build_object('order_id', p_order_id, 'primary', v_primary_w, 'items', v_per_item);
END;
$$;
GRANT EXECUTE ON FUNCTION public.route_order_to_supplier(uuid) TO authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 7. RPC: reassign_order_supplier (David's manual override)
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.reassign_order_supplier(
  p_order_id uuid,
  p_new_wholesaler_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev_w uuid;
  v_item RECORD;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner')) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  -- block if any fulfillment already shipped
  IF EXISTS (SELECT 1 FROM public.marketplace_fulfillments
              WHERE order_id = p_order_id AND status IN ('shipped','completed')) THEN
    RAISE EXCEPTION 'order_already_shipped';
  END IF;

  SELECT assigned_wholesaler_id INTO v_prev_w
    FROM public.order_routing WHERE order_id = p_order_id LIMIT 1;

  -- release old + reserve new, atomically per item
  FOR v_item IN
    SELECT id, product_id, qty, wholesaler_id FROM public.marketplace_order_items
     WHERE order_id = p_order_id
  LOOP
    IF v_item.wholesaler_id IS NOT NULL AND v_item.product_id IS NOT NULL THEN
      PERFORM public.release_marketplace_inventory(v_item.product_id, v_item.wholesaler_id, v_item.qty);
    END IF;
    BEGIN
      PERFORM public.reserve_marketplace_inventory(v_item.product_id, p_new_wholesaler_id, v_item.qty);
    EXCEPTION WHEN OTHERS THEN
      -- rollback: re-reserve original
      PERFORM public.reserve_marketplace_inventory(v_item.product_id, v_item.wholesaler_id, v_item.qty);
      RAISE EXCEPTION 'reserve_failed_on_new_supplier: %', SQLERRM;
    END;
    UPDATE public.marketplace_order_items
       SET wholesaler_id = p_new_wholesaler_id
     WHERE id = v_item.id;
  END LOOP;

  -- repoint fulfillments
  DELETE FROM public.marketplace_fulfillments
   WHERE order_id = p_order_id AND status = 'pending'
     AND wholesaler_id <> p_new_wholesaler_id;

  INSERT INTO public.marketplace_fulfillments (order_id, wholesaler_id, status, shipping_mode)
  VALUES (p_order_id, p_new_wholesaler_id, 'pending', 'sandbox')
  ON CONFLICT (order_id, wholesaler_id) DO NOTHING;

  UPDATE public.order_routing
     SET assigned_wholesaler_id = p_new_wholesaler_id,
         routing_reason = 'manual_pin',
         manual_override = true,
         override_by = auth.uid(),
         override_reason = p_reason,
         override_at = now()
   WHERE order_id = p_order_id;

  -- record an order pin
  INSERT INTO public.dd_routing_pins (pin_type, order_id, pinned_wholesaler_id, reason, created_by)
  VALUES ('order', p_order_id, p_new_wholesaler_id, p_reason, auth.uid())
  ON CONFLICT (order_id) WHERE pin_type='order' DO UPDATE
    SET pinned_wholesaler_id = EXCLUDED.pinned_wholesaler_id,
        reason = EXCLUDED.reason, created_by = EXCLUDED.created_by, created_at = now();

  INSERT INTO public.dd_routing_audit (event_type, order_id, wholesaler_id, prev_value, new_value, reason, actor)
  VALUES ('manual_override', p_order_id, p_new_wholesaler_id,
          jsonb_build_object('wholesaler_id', v_prev_w),
          jsonb_build_object('wholesaler_id', p_new_wholesaler_id),
          p_reason, auth.uid());

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id, 'new_wholesaler', p_new_wholesaler_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.reassign_order_supplier(uuid, uuid, text) TO authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 8. GRABBA BRIDGE RPCs
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.dd_link_wholesaler_to_store_master(p_wholesaler_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
  v_w public.wholesaler_profiles%ROWTYPE;
  v_store_id uuid;
BEGIN
  SELECT store_master_id INTO v_existing
    FROM public.dd_wholesaler_store_link WHERE wholesaler_id = p_wholesaler_id;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  SELECT * INTO v_w FROM public.wholesaler_profiles WHERE id = p_wholesaler_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'wholesaler_not_found'; END IF;

  INSERT INTO public.store_master (
    store_name, address, city, state, zip, phone, email, owner_name,
    store_type, notes, is_historical, consent_source
  ) VALUES (
    COALESCE(v_w.company_name, 'DD Wholesaler'),
    COALESCE(v_w.warehouse_street, v_w.warehouse_address, 'Unknown'),
    COALESCE(v_w.warehouse_city, 'Unknown'),
    COALESCE(v_w.warehouse_state, 'NY'),
    COALESCE(v_w.warehouse_zip, '00000'),
    v_w.phone, v_w.email, v_w.contact_name,
    'dynasty_direct_wholesaler',
    'Auto-linked via Dynasty Direct Grabba Bridge', false, 'dynasty_direct_wholesaler'
  ) RETURNING id INTO v_store_id;

  INSERT INTO public.dd_wholesaler_store_link (wholesaler_id, store_master_id)
  VALUES (p_wholesaler_id, v_store_id);

  RETURN v_store_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.dd_link_wholesaler_to_store_master(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.dd_create_grabba_order(
  p_wholesaler_id uuid,
  p_brand text,
  p_boxes integer,
  p_requested_day text DEFAULT 'this_week',
  p_requested_window text DEFAULT 'morning',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_prs_id uuid;
  v_caller uuid := auth.uid();
BEGIN
  -- only the owning wholesaler user, admin, or owner may create
  IF NOT (
    public.has_role(v_caller,'admin') OR public.has_role(v_caller,'owner')
    OR EXISTS (SELECT 1 FROM public.wholesaler_profiles WHERE id = p_wholesaler_id AND user_id = v_caller)
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_boxes IS NULL OR p_boxes <= 0 THEN RAISE EXCEPTION 'invalid_boxes'; END IF;

  v_store_id := public.dd_link_wholesaler_to_store_master(p_wholesaler_id);

  INSERT INTO public.pending_route_stops (
    store_id, store_name, requested_day, requested_window, urgency,
    intent_summary, recommended_boxes, recommended_brand, status,
    signal_source, reason, source_ref, business, ai_payload
  )
  SELECT
    v_store_id,
    sm.store_name,
    p_requested_day, p_requested_window, 'this_week',
    COALESCE(p_notes, 'DD wholesaler grabba order'),
    p_boxes, p_brand, 'pending_approval',
    'owner_order', 'DD wholesaler grabba order',
    p_wholesaler_id::text, 'gasmask',
    jsonb_build_object(
      'source', 'dynasty_direct_grabba_bridge',
      'wholesaler_id', p_wholesaler_id,
      'brand', p_brand,
      'boxes', p_boxes
    )
  FROM public.store_master sm WHERE sm.id = v_store_id
  RETURNING id INTO v_prs_id;

  RETURN jsonb_build_object(
    'ok', true,
    'pending_route_stop_id', v_prs_id,
    'store_master_id', v_store_id,
    'wholesaler_id', p_wholesaler_id
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.dd_create_grabba_order(uuid, text, integer, text, text, text) TO authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 9. Cross-bridge read-back: wholesaler sees their grabba orders
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.dd_wholesaler_grabba_orders AS
SELECT
  prs.id AS pending_route_stop_id,
  prs.created_at,
  prs.recommended_brand AS brand,
  prs.recommended_boxes AS boxes,
  prs.status,
  prs.requested_day,
  prs.requested_window,
  prs.route_stop_id,
  prs.source_ref::uuid AS wholesaler_id,
  l.store_master_id,
  sm.store_name
FROM public.pending_route_stops prs
JOIN public.dd_wholesaler_store_link l
  ON l.store_master_id = prs.store_id
JOIN public.store_master sm ON sm.id = prs.store_id
WHERE prs.business = 'gasmask'
  AND prs.signal_source = 'owner_order'
  AND prs.ai_payload->>'source' = 'dynasty_direct_grabba_bridge';

GRANT SELECT ON public.dd_wholesaler_grabba_orders TO authenticated;
