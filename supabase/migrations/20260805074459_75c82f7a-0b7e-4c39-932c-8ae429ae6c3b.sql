-- 1. Campaign → wholesaler SET
CREATE TABLE public.dd_campaign_wholesalers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.dd_campaigns(id) ON DELETE CASCADE,
  wholesaler_id uuid NOT NULL REFERENCES public.wholesaler_profiles(id) ON DELETE CASCADE,
  weight integer NOT NULL DEFAULT 50,
  priority integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dd_campaign_wholesalers_unique_pair UNIQUE (campaign_id, wholesaler_id)
);

CREATE INDEX idx_dd_campaign_wholesalers_campaign ON public.dd_campaign_wholesalers(campaign_id);
CREATE INDEX idx_dd_campaign_wholesalers_wholesaler ON public.dd_campaign_wholesalers(wholesaler_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_campaign_wholesalers TO authenticated;
GRANT ALL ON public.dd_campaign_wholesalers TO service_role;

ALTER TABLE public.dd_campaign_wholesalers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dd_cw_admin_all" ON public.dd_campaign_wholesalers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "dd_cw_wholesaler_view" ON public.dd_campaign_wholesalers
  FOR SELECT TO authenticated
  USING (wholesaler_id IN (
    SELECT wp.id FROM public.wholesaler_profiles wp WHERE wp.user_id = auth.uid()
  ));

CREATE POLICY "dd_cw_ambassador_view" ON public.dd_campaign_wholesalers
  FOR SELECT TO authenticated
  USING (campaign_id IN (
    SELECT c.id FROM public.dd_campaigns c
    JOIN public.ambassadors a ON a.id = c.ambassador_id
    WHERE a.user_id = auth.uid()
  ));

CREATE TRIGGER trg_dd_campaign_wholesalers_updated_at
  BEFORE UPDATE ON public.dd_campaign_wholesalers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Per-item commission attribution columns
ALTER TABLE public.dd_partner_earnings
  ADD COLUMN IF NOT EXISTS order_item_id uuid REFERENCES public.marketplace_order_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS wholesaler_profile_id uuid REFERENCES public.wholesaler_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dd_pe_order_item ON public.dd_partner_earnings(order_item_id);

-- 3. Campaign-aware supplier picker
DROP FUNCTION IF EXISTS public.dd_pick_supplier_for_item(uuid, integer, text, double precision, double precision);

CREATE OR REPLACE FUNCTION public.dd_pick_supplier_for_item(
  p_product_id uuid,
  p_qty integer,
  p_ship_state text,
  p_ship_lat double precision,
  p_ship_lng double precision,
  p_campaign_id uuid DEFAULT NULL
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
BEGIN
  -- 0. CAMPAIGN SET ROUTING (takes precedence when the campaign defines a set)
  IF p_campaign_id IS NOT NULL THEN
    SELECT count(*) INTO v_set_count
    FROM dd_campaign_wholesalers cw
    WHERE cw.campaign_id = p_campaign_id AND cw.active = true;

    IF v_set_count > 0 THEN
      WITH set_candidates AS (
        SELECT
          w.id,
          cw.weight,
          cw.priority,
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
      ORDER BY
        priority DESC,
        in_state DESC,
        miles ASC NULLS LAST,
        weight DESC,
        id
      LIMIT 1;

      IF v_wid IS NOT NULL THEN
        RETURN QUERY SELECT v_wid, 'campaign_set'::text,
          jsonb_build_object(
            'rule', 'campaign_set',
            'campaign_id', p_campaign_id,
            'set_size', v_set_count,
            'in_state', v_in_state,
            'miles', CASE WHEN v_dist IS NULL THEN NULL ELSE round(v_dist::numeric, 1) END,
            'weight', v_weight
          );
        RETURN;
      END IF;
      -- No member of the set can fill this item → fall through to the
      -- normal cascade below (documented, deliberate behavior).
    END IF;
  END IF;

  -- 1. Per-product pin overrides geography
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
    WITH candidates AS (
      SELECT
        w.id,
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
    ORDER BY (miles - (weight * 2.0)) ASC, miles ASC
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

  -- 6. Last resort: product's home wholesaler
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
$function$;