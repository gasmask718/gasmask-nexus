-- Drop ambiguous 8-arg overload, keep 9-arg with p_discount_code DEFAULT NULL
DROP FUNCTION IF EXISTS public.dd_create_marketplace_order(jsonb, jsonb, text, text, uuid, numeric, numeric, numeric, text);

CREATE OR REPLACE FUNCTION public.dd_create_marketplace_order(
  p_items jsonb,
  p_shipping_address jsonb,
  p_guest_email text DEFAULT NULL,
  p_guest_phone text DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL,
  p_subtotal numeric DEFAULT 0,
  p_shipping_cost numeric DEFAULT 0,
  p_tax_amount numeric DEFAULT 0,
  p_notes text DEFAULT NULL,
  p_discount_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_user_id uuid;
  v_total numeric;
  v_item jsonb;
  v_routing jsonb;
  v_discount jsonb;
  v_discount_amount numeric := 0;
  v_guest_bucket uuid := '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'items_required';
  END IF;

  v_user_id := COALESCE(p_customer_id, auth.uid(), v_guest_bucket);

  -- Validate + apply discount
  IF p_discount_code IS NOT NULL AND length(trim(p_discount_code)) > 0 THEN
    v_discount := public.validate_discount(p_discount_code, p_customer_id, p_guest_email);
    IF (v_discount->>'valid')::boolean IS NOT TRUE THEN
      RETURN jsonb_build_object('success', false, 'error', 'discount_invalid', 'detail', v_discount->>'error');
    END IF;
    IF v_discount->>'type' = 'percent' THEN
      v_discount_amount := round((COALESCE(p_subtotal,0) * (v_discount->>'value')::numeric / 100)::numeric, 2);
    ELSE
      v_discount_amount := least(COALESCE(p_subtotal,0), (v_discount->>'value')::numeric);
    END IF;
  END IF;

  v_total := greatest(0, COALESCE(p_subtotal,0) - v_discount_amount)
           + COALESCE(p_shipping_cost,0) + COALESCE(p_tax_amount,0);

  INSERT INTO public.marketplace_orders (
    user_id, shipping_address, billing_address,
    order_type, payment_status, fulfillment_status,
    subtotal, shipping_cost, tax_amount, total,
    notes, customer_email, customer_phone,
    discount_code, discount_amount
  ) VALUES (
    v_user_id, p_shipping_address, p_shipping_address,
    'customer', 'pending', 'pending',
    COALESCE(p_subtotal,0), COALESCE(p_shipping_cost,0), COALESCE(p_tax_amount,0), v_total,
    p_notes, p_guest_email, p_guest_phone,
    p_discount_code, v_discount_amount
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.marketplace_order_items (order_id, product_id, qty, price_each)
    VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      COALESCE((v_item->>'qty')::int, (v_item->>'quantity')::int, 1),
      COALESCE((v_item->>'price_each')::numeric, (v_item->>'price')::numeric, 0)
    );
  END LOOP;

  -- Route (best effort, capture result)
  BEGIN
    v_routing := public.route_order_to_supplier(v_order_id);
  EXCEPTION WHEN OTHERS THEN
    v_routing := jsonb_build_object('error', SQLERRM);
  END;

  -- Reserve inventory (best effort)
  BEGIN
    UPDATE public.marketplace_inventory mi
    SET reserved_quantity = mi.reserved_quantity + oi.qty,
        updated_at = now()
    FROM public.marketplace_order_items oi
    WHERE oi.order_id = v_order_id
      AND oi.wholesaler_id IS NOT NULL
      AND mi.wholesaler_id = oi.wholesaler_id
      AND mi.product_id = oi.product_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  IF p_discount_code IS NOT NULL AND v_discount_amount > 0 THEN
    PERFORM public.increment_discount_usage(p_discount_code);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'total', v_total,
    'discount_amount', v_discount_amount,
    'routing', v_routing
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.dd_create_marketplace_order(jsonb,jsonb,text,text,uuid,numeric,numeric,numeric,text,text) TO anon, authenticated, service_role;