
-- ---------- (2) marketplace_inventory: wholesaler SELECT ----------
DROP POLICY IF EXISTS "Wholesalers view own inventory" ON public.marketplace_inventory;
CREATE POLICY "Wholesalers view own inventory"
  ON public.marketplace_inventory FOR SELECT
  TO authenticated
  USING (wholesaler_id IN (SELECT id FROM public.wholesaler_profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Wholesalers update own inventory" ON public.marketplace_inventory;
CREATE POLICY "Wholesalers update own inventory"
  ON public.marketplace_inventory FOR UPDATE
  TO authenticated
  USING (wholesaler_id IN (SELECT id FROM public.wholesaler_profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Wholesalers insert own inventory" ON public.marketplace_inventory;
CREATE POLICY "Wholesalers insert own inventory"
  ON public.marketplace_inventory FOR INSERT
  TO authenticated
  WITH CHECK (wholesaler_id IN (SELECT id FROM public.wholesaler_profiles WHERE user_id = auth.uid()));

-- ---------- (3) invites RLS tighten + safe token lookup ----------
DROP POLICY IF EXISTS "Public can read invites by token" ON public.invites;

CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token text)
RETURNS TABLE (
  role app_role,
  status text,
  expires_at timestamptz,
  inviter_display_name text,
  channel text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.role, i.status, i.expires_at,
         COALESCE(p.name, 'A team member') AS inviter_display_name,
         i.channel
  FROM public.invites i
  LEFT JOIN public.profiles p ON p.id = i.invited_by
  WHERE i.token = p_token
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO anon, authenticated;

-- ---------- (1) UNIFIED ORDER PIPELINE ----------
CREATE OR REPLACE FUNCTION public.dd_create_marketplace_order(
  p_items jsonb,
  p_shipping_address jsonb,
  p_guest_email text DEFAULT NULL,
  p_guest_phone text DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL,
  p_subtotal numeric DEFAULT 0,
  p_shipping_cost numeric DEFAULT 0,
  p_tax_amount numeric DEFAULT 0,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_user_id uuid;
  v_total numeric;
  v_item jsonb;
  v_routing jsonb;
  v_guest_bucket uuid := '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'items_required';
  END IF;

  v_user_id := COALESCE(p_customer_id, auth.uid(), v_guest_bucket);
  v_total := COALESCE(p_subtotal,0) + COALESCE(p_shipping_cost,0) + COALESCE(p_tax_amount,0);

  INSERT INTO public.marketplace_orders (
    user_id, shipping_address, billing_address,
    order_type, payment_status, fulfillment_status,
    subtotal, shipping_cost, tax_amount, total,
    notes, customer_email, customer_phone
  ) VALUES (
    v_user_id, p_shipping_address, p_shipping_address,
    'customer', 'pending', 'pending',
    COALESCE(p_subtotal,0), COALESCE(p_shipping_cost,0),
    COALESCE(p_tax_amount,0), v_total,
    p_notes, p_guest_email, p_guest_phone
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.marketplace_order_items (
      order_id, product_id, qty, price_each
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      COALESCE((v_item->>'qty')::int, 1),
      COALESCE((v_item->>'price_each')::numeric, 0)
    );
  END LOOP;

  BEGIN
    v_routing := public.route_order_to_supplier(v_order_id);
  EXCEPTION WHEN OTHERS THEN
    v_routing := jsonb_build_object('error', SQLERRM);
  END;

  UPDATE public.marketplace_inventory mi
  SET reserved_quantity = mi.reserved_quantity + oi.qty,
      updated_at = now()
  FROM public.marketplace_order_items oi
  WHERE oi.order_id = v_order_id
    AND oi.wholesaler_id IS NOT NULL
    AND mi.wholesaler_id = oi.wholesaler_id
    AND mi.product_id = oi.product_id;

  RETURN jsonb_build_object('order_id', v_order_id, 'total', v_total, 'routing', v_routing);
END;
$$;
GRANT EXECUTE ON FUNCTION public.dd_create_marketplace_order(jsonb, jsonb, text, text, uuid, numeric, numeric, numeric, text) TO anon, authenticated;

-- ---------- (5) Stock lifecycle helpers + trigger ----------
CREATE OR REPLACE FUNCTION public.dd_release_order_reservations(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.marketplace_inventory mi
  SET reserved_quantity = GREATEST(0, mi.reserved_quantity - oi.qty), updated_at = now()
  FROM public.marketplace_order_items oi
  WHERE oi.order_id = p_order_id
    AND mi.wholesaler_id = oi.wholesaler_id
    AND mi.product_id = oi.product_id;
END;$$;
GRANT EXECUTE ON FUNCTION public.dd_release_order_reservations(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.dd_consume_order_reservations(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.marketplace_inventory mi
  SET quantity_available = GREATEST(0, mi.quantity_available - oi.qty),
      reserved_quantity = GREATEST(0, mi.reserved_quantity - oi.qty),
      updated_at = now()
  FROM public.marketplace_order_items oi
  WHERE oi.order_id = p_order_id
    AND mi.wholesaler_id = oi.wholesaler_id
    AND mi.product_id = oi.product_id;
END;$$;
GRANT EXECUTE ON FUNCTION public.dd_consume_order_reservations(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_dd_inventory_lifecycle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM 'paid' THEN
    PERFORM public.dd_consume_order_reservations(NEW.id);
  END IF;
  IF NEW.fulfillment_status = 'cancelled' AND OLD.fulfillment_status IS DISTINCT FROM 'cancelled' THEN
    PERFORM public.dd_release_order_reservations(NEW.id);
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_dd_inv_lifecycle ON public.marketplace_orders;
CREATE TRIGGER trg_dd_inv_lifecycle
  AFTER UPDATE OF payment_status, fulfillment_status ON public.marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_dd_inventory_lifecycle();
