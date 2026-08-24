
-- ─── 1. Approval gate on reserve/payout rows ──────────────────────────────
ALTER TABLE public.dd_reserve_ledger
  ADD COLUMN IF NOT EXISTS approval_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'rolling_reserve';

CREATE INDEX IF NOT EXISTS idx_dd_reserve_ledger_pending
  ON public.dd_reserve_ledger (status, approved_at, release_at);

-- ─── 2. Category pins for promo routing ───────────────────────────────────
ALTER TABLE public.dd_routing_pins
  ADD COLUMN IF NOT EXISTS category text;

-- ─── 3. Split writer: called by the Stripe webhook when an order is paid ──
CREATE OR REPLACE FUNCTION public.dd_write_order_split(
  p_order_id uuid,
  p_charge_id text DEFAULT NULL,
  p_stripe_fee_cents bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cfg record;
  v_order record;
  v_total_cents bigint;
  v_fee_cents bigint;
  v_rows int := 0;
  v_grp record;
  v_hold_days int;
  v_reserve_pct numeric;
  v_gross bigint;
  v_cost bigint;
  v_fee_share bigint;
  v_reserve bigint;
  v_payable bigint;
  v_margin bigint;
  v_fid uuid;
BEGIN
  SELECT * INTO v_order FROM marketplace_orders WHERE id = p_order_id;
  IF v_order IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;

  -- idempotent
  IF EXISTS (SELECT 1 FROM dd_split_ledger WHERE order_id = p_order_id) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'already_split');
  END IF;

  SELECT * INTO v_cfg FROM dd_config LIMIT 1;
  v_hold_days := coalesce(v_cfg.reserve_hold_days, 45);

  v_total_cents := round(coalesce(v_order.total, 0) * 100)::bigint;
  v_fee_cents := coalesce(
    p_stripe_fee_cents,
    CASE WHEN v_total_cents > 0 THEN round(v_total_cents * 0.029)::bigint + 30 ELSE 0 END
  );

  FOR v_grp IN
    SELECT
      oi.wholesaler_id,
      sum(round(oi.qty * coalesce(oi.price_each,0) * 100))::bigint AS gross_cents,
      sum(round(oi.qty * coalesce(p.supplier_cost, p.wholesale_price, 0) * 100))::bigint AS cost_cents
    FROM marketplace_order_items oi
    LEFT JOIN products_all p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id AND oi.wholesaler_id IS NOT NULL
    GROUP BY oi.wholesaler_id
  LOOP
    v_gross := coalesce(v_grp.gross_cents, 0);
    v_cost  := coalesce(v_grp.cost_cents, 0);

    SELECT coalesce(w.reserve_pct, v_cfg.default_reserve_pct, 8)
      INTO v_reserve_pct
    FROM wholesaler_profiles w WHERE w.id = v_grp.wholesaler_id;
    v_reserve_pct := coalesce(v_reserve_pct, 8);

    -- pro-rata share of the card fee
    v_fee_share := CASE
      WHEN v_total_cents > 0 THEN round(v_fee_cents * (v_gross::numeric / v_total_cents))::bigint
      ELSE 0 END;

    v_reserve := round(v_cost * v_reserve_pct / 100.0)::bigint;
    v_payable := greatest(v_cost - v_reserve, 0);
    v_margin  := v_gross - v_fee_share - v_cost;

    SELECT id INTO v_fid FROM marketplace_fulfillments
      WHERE order_id = p_order_id AND wholesaler_id = v_grp.wholesaler_id LIMIT 1;

    INSERT INTO dd_split_ledger (
      order_id, fulfillment_id, wholesaler_id, gross_amount_cents, stripe_fee_cents,
      dd_margin_cents, supplier_transfer_cents, reserve_held_cents, reserve_released_cents,
      margin_pct_applied, reserve_pct_applied, stripe_charge_id, status, notes
    ) VALUES (
      p_order_id, v_fid, v_grp.wholesaler_id, v_gross, v_fee_share,
      v_margin, v_cost, v_reserve, 0,
      CASE WHEN v_gross > 0 THEN round(v_margin::numeric * 100 / v_gross, 2) ELSE 0 END,
      v_reserve_pct, p_charge_id, 'pending_approval',
      'auto-written by dd_write_order_split on payment'
    );

    -- money owed now (still requires a human to approve)
    IF v_payable > 0 THEN
      INSERT INTO dd_reserve_ledger (
        wholesaler_id, order_id, fulfillment_id, amount_cents,
        release_at, status, kind, approval_required, notes
      ) VALUES (
        v_grp.wholesaler_id, p_order_id, v_fid, v_payable,
        now(), 'held', 'supplier_payable', true,
        'supplier payable — awaiting admin approval'
      );
    END IF;

    -- rolling reserve held for reserve_hold_days
    IF v_reserve > 0 THEN
      INSERT INTO dd_reserve_ledger (
        wholesaler_id, order_id, fulfillment_id, amount_cents,
        release_at, status, kind, approval_required, notes
      ) VALUES (
        v_grp.wholesaler_id, p_order_id, v_fid, v_reserve,
        now() + (v_hold_days || ' days')::interval, 'held', 'rolling_reserve', true,
        format('%s-day rolling reserve — awaiting admin approval', v_hold_days)
      );
    END IF;

    v_rows := v_rows + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'groups', v_rows, 'fee_cents', v_fee_cents);
END;
$$;

GRANT EXECUTE ON FUNCTION public.dd_write_order_split(uuid, text, bigint) TO service_role;

-- ─── 4. Admin approval of a payout / reserve row ──────────────────────────
CREATE OR REPLACE FUNCTION public.dd_approve_reserve_release(
  p_reserve_id uuid,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_row record;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO v_row FROM dd_reserve_ledger WHERE id = p_reserve_id FOR UPDATE;
  IF v_row IS NULL THEN RAISE EXCEPTION 'reserve_not_found'; END IF;
  IF v_row.status <> 'held' THEN RAISE EXCEPTION 'not_releasable: %', v_row.status; END IF;

  UPDATE dd_reserve_ledger
     SET approved_at = now(),
         approved_by = auth.uid(),
         notes = coalesce(p_note, notes)
   WHERE id = p_reserve_id;

  UPDATE dd_split_ledger
     SET status = 'approved', updated_at = now()
   WHERE order_id = v_row.order_id
     AND wholesaler_id = v_row.wholesaler_id
     AND status = 'pending_approval';

  RETURN jsonb_build_object('ok', true, 'reserve_id', p_reserve_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.dd_approve_reserve_release(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dd_approve_reserve_release(uuid, text) TO service_role;

-- ─── 5. Promo pinning + category pins in the supplier picker ──────────────
CREATE OR REPLACE FUNCTION public.dd_pick_supplier_for_item(
  p_product_id uuid, p_qty integer, p_ship_state text,
  p_ship_lat double precision, p_ship_lng double precision,
  p_campaign_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(wholesaler_id uuid, routing_reason text, routing_details jsonb)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_state text := upper(coalesce(p_ship_state, ''));
  v_wid uuid;
  v_dist double precision;
  v_home_wid uuid;
  v_in_state boolean;
  v_weight integer;
  v_set_count integer := 0;
  v_category text;
BEGIN
  -- 0a. PROMO PIN: campaign names a single preferred wholesaler
  IF p_campaign_id IS NOT NULL THEN
    SELECT c.preferred_wholesaler_id INTO v_wid
    FROM dd_campaigns c
    JOIN wholesaler_profiles w ON w.id = c.preferred_wholesaler_id
    WHERE c.id = p_campaign_id
      AND c.preferred_wholesaler_id IS NOT NULL
      AND coalesce(w.routing_paused, false) = false
      AND (c.product_ids IS NULL OR array_length(c.product_ids, 1) IS NULL
           OR p_product_id = ANY (c.product_ids))
    LIMIT 1;
    IF v_wid IS NOT NULL THEN
      RETURN QUERY SELECT v_wid, 'promo_pinned'::text,
        jsonb_build_object('rule', 'campaign_preferred_wholesaler',
                           'campaign_id', p_campaign_id);
      RETURN;
    END IF;
  END IF;

  -- 0b. CAMPAIGN SET ROUTING
  IF p_campaign_id IS NOT NULL THEN
    SELECT count(*) INTO v_set_count
    FROM dd_campaign_wholesalers cw
    WHERE cw.campaign_id = p_campaign_id AND cw.active = true;

    IF v_set_count > 0 THEN
      WITH set_candidates AS (
        SELECT
          w.id, cw.weight, cw.priority,
          (v_state <> '' AND upper(coalesce(w.warehouse_state, '')) = v_state) AS in_state,
          CASE
            WHEN p_ship_lat IS NULL OR p_ship_lng IS NULL
              OR w.warehouse_lat IS NULL OR w.warehouse_lng IS NULL THEN NULL
            ELSE 3958.8 * acos(
              least(1.0, greatest(-1.0,
                cos(radians(p_ship_lat)) * cos(radians(w.warehouse_lat)) *
                cos(radians(w.warehouse_lng) - radians(p_ship_lng)) +
                sin(radians(p_ship_lat)) * sin(radians(w.warehouse_lat))
              ))
            )
          END AS miles
        FROM dd_campaign_wholesalers cw
        JOIN wholesaler_profiles w ON w.id = cw.wholesaler_id
        JOIN marketplace_inventory i
          ON i.wholesaler_id = w.id AND i.product_id = p_product_id
        WHERE cw.campaign_id = p_campaign_id
          AND cw.active = true
          AND coalesce(w.routing_paused, false) = false
          AND (i.quantity_available - coalesce(i.reserved_quantity, 0)) >= p_qty
      )
      SELECT id, in_state, miles, weight
        INTO v_wid, v_in_state, v_dist, v_weight
      FROM set_candidates
      ORDER BY priority DESC, in_state DESC, miles ASC NULLS LAST, weight DESC, id
      LIMIT 1;

      IF v_wid IS NOT NULL THEN
        RETURN QUERY SELECT v_wid, 'campaign_set'::text,
          jsonb_build_object('rule', 'campaign_set', 'campaign_id', p_campaign_id,
            'set_size', v_set_count, 'in_state', v_in_state,
            'miles', CASE WHEN v_dist IS NULL THEN NULL ELSE round(v_dist::numeric, 1) END,
            'weight', v_weight);
        RETURN;
      END IF;
    END IF;
  END IF;

  -- 1. Per-product pin
  SELECT pinned_wholesaler_id INTO v_wid
  FROM dd_routing_pins p
  JOIN wholesaler_profiles w ON w.id = p.pinned_wholesaler_id
  WHERE p.pin_type = 'product' AND p.product_id = p_product_id
    AND coalesce(w.routing_paused, false) = false
  LIMIT 1;
  IF v_wid IS NOT NULL THEN
    RETURN QUERY SELECT v_wid, 'pin_product'::text, jsonb_build_object('rule', 'product_pin');
    RETURN;
  END IF;

  -- 1b. Per-category pin (preferred wholesaler for a whole category)
  SELECT category INTO v_category FROM products_all WHERE id = p_product_id;
  IF v_category IS NOT NULL THEN
    SELECT pinned_wholesaler_id INTO v_wid
    FROM dd_routing_pins p
    JOIN wholesaler_profiles w ON w.id = p.pinned_wholesaler_id
    WHERE p.pin_type = 'category' AND p.category = v_category
      AND coalesce(w.routing_paused, false) = false
    LIMIT 1;
    IF v_wid IS NOT NULL THEN
      RETURN QUERY SELECT v_wid, 'pin_category'::text,
        jsonb_build_object('rule', 'category_pin', 'category', v_category);
      RETURN;
    END IF;
  END IF;

  -- 2. Per-state pin
  IF v_state <> '' THEN
    SELECT pinned_wholesaler_id INTO v_wid
    FROM dd_routing_pins p
    JOIN wholesaler_profiles w ON w.id = p.pinned_wholesaler_id
    WHERE p.pin_type = 'state' AND p.state_code = v_state
      AND coalesce(w.routing_paused, false) = false
    LIMIT 1;
    IF v_wid IS NOT NULL THEN
      RETURN QUERY SELECT v_wid, 'pin_state'::text,
        jsonb_build_object('rule', 'state_pin', 'state', v_state);
      RETURN;
    END IF;
  END IF;

  -- 3. In-state supplier with stock
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

  -- 4. Nearest supplier with stock
  IF p_ship_lat IS NOT NULL AND p_ship_lng IS NOT NULL THEN
    SELECT w.id,
      3958.8 * acos(least(1.0, greatest(-1.0,
        cos(radians(p_ship_lat)) * cos(radians(w.warehouse_lat)) *
        cos(radians(w.warehouse_lng) - radians(p_ship_lng)) +
        sin(radians(p_ship_lat)) * sin(radians(w.warehouse_lat)))))
      INTO v_wid, v_dist
    FROM wholesaler_profiles w
    JOIN marketplace_inventory i ON i.wholesaler_id = w.id AND i.product_id = p_product_id
    WHERE coalesce(w.routing_paused, false) = false
      AND w.warehouse_lat IS NOT NULL AND w.warehouse_lng IS NOT NULL
      AND (i.quantity_available - coalesce(i.reserved_quantity, 0)) >= p_qty
    ORDER BY 2 ASC
    LIMIT 1;
    IF v_wid IS NOT NULL THEN
      RETURN QUERY SELECT v_wid, 'nearest'::text,
        jsonb_build_object('rule', 'nearest', 'miles', round(v_dist::numeric, 1));
      RETURN;
    END IF;
  END IF;

  -- 5. Default supplier
  SELECT w.id INTO v_wid
  FROM wholesaler_profiles w
  WHERE coalesce(w.is_default_supplier, false) = true
    AND coalesce(w.routing_paused, false) = false
  ORDER BY coalesce(w.priority_weight, 50) DESC
  LIMIT 1;
  IF v_wid IS NOT NULL THEN
    RETURN QUERY SELECT v_wid, 'default'::text, jsonb_build_object('rule', 'default_supplier');
    RETURN;
  END IF;

  -- 6. Product home supplier
  SELECT p.wholesaler_id INTO v_home_wid FROM products_all p WHERE p.id = p_product_id;
  IF v_home_wid IS NOT NULL THEN
    RETURN QUERY SELECT v_home_wid, 'fallback_home'::text,
      jsonb_build_object('rule', 'product_home_supplier');
    RETURN;
  END IF;

  RETURN;
END;
$function$;
