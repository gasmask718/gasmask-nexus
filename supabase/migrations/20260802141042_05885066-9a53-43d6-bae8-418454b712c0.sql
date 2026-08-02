DROP FUNCTION IF EXISTS public.dd_create_marketplace_order(jsonb, jsonb, text, text, uuid, numeric, numeric, numeric, text, text, text, uuid, uuid);

CREATE OR REPLACE FUNCTION public.dd_create_marketplace_order(
  p_items jsonb,
  p_shipping_address jsonb,
  p_guest_email text DEFAULT NULL::text,
  p_guest_phone text DEFAULT NULL::text,
  p_customer_id uuid DEFAULT NULL::uuid,
  p_subtotal numeric DEFAULT 0,
  p_shipping_cost numeric DEFAULT 0,
  p_tax_amount numeric DEFAULT 0,
  p_notes text DEFAULT NULL::text,
  p_discount_code text DEFAULT NULL::text,
  p_affiliate_code text DEFAULT NULL::text,
  p_ambassador_id uuid DEFAULT NULL::uuid,
  p_ordering_store_id uuid DEFAULT NULL::uuid,
  p_age_confirmed_at timestamptz DEFAULT NULL,
  p_age_confirmed_ip text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid; v_user uuid;
  v_guest_bucket constant uuid := '00000000-0000-0000-0000-000000000001';
  v_item jsonb; v_discount_amount numeric := 0; v_discount record;
  v_total numeric; v_routing jsonb := '[]'::jsonb;
  v_affiliate record; v_commission numeric := 0;
  v_aff_id uuid; v_aff_rate numeric; v_aff_code text;
  v_amb_rate numeric; v_amb_commission numeric := 0;
  v_gross numeric;
  v_qty int;
  v_pid uuid;
  v_product record;
  v_unit_price numeric;
  v_retail_effective numeric;
  v_store_effective numeric;
  v_tier text;
  v_subtotal_server numeric := 0;
  v_age_at timestamptz;
BEGIN
  v_user := COALESCE(p_customer_id, auth.uid(), v_guest_bucket);

  IF auth.uid() IS NULL THEN
    v_tier := 'retail';
  ELSIF public.has_role(auth.uid(), 'wholesaler'::app_role)
     OR public.has_role(auth.uid(), 'wholesale'::app_role) THEN
    v_tier := 'wholesale';
  ELSIF public.has_role(auth.uid(), 'store'::app_role) THEN
    v_tier := 'store';
  ELSE
    v_tier := 'retail';
  END IF;

  -- Age-verification audit trail: dedicated columns, never notes text.
  v_age_at := CASE
    WHEN p_age_confirmed_at IS NOT NULL THEN p_age_confirmed_at
    WHEN p_age_confirmed_ip IS NOT NULL THEN now()
    ELSE NULL
  END;

  INSERT INTO public.marketplace_orders(
    user_id, customer_email, customer_phone, shipping_address,
    subtotal, shipping_cost, tax_amount, discount_code, discount_amount, total,
    payment_status, fulfillment_status, notes,
    ambassador_id, ordering_store_id,
    age_confirmed, age_confirmed_at, age_confirmed_ip
  ) VALUES (
    v_user, p_guest_email, p_guest_phone, p_shipping_address,
    0, COALESCE(p_shipping_cost,0), COALESCE(p_tax_amount,0),
    p_discount_code, 0, 0,
    'pending','pending', p_notes,
    p_ambassador_id, p_ordering_store_id,
    (v_age_at IS NOT NULL), v_age_at, p_age_confirmed_ip
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := COALESCE((v_item->>'qty')::int, (v_item->>'quantity')::int, 0);
    IF v_pid IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'invalid line item: %', v_item;
    END IF;

    SELECT id, status, retail_price, store_price, wholesale_price,
           dtc_price_b, store_price_a
      INTO v_product
      FROM public.products_all
     WHERE id = v_pid;

    IF NOT FOUND OR v_product.status <> 'active' THEN
      RAISE EXCEPTION 'product not available: %', v_pid;
    END IF;

    v_retail_effective := COALESCE(NULLIF(v_product.dtc_price_b, 0), NULLIF(v_product.retail_price, 0));
    v_store_effective  := COALESCE(NULLIF(v_product.store_price_a, 0), NULLIF(v_product.store_price, 0));

    v_unit_price := CASE v_tier
      WHEN 'wholesale' THEN COALESCE(NULLIF(v_product.wholesale_price, 0), v_retail_effective)
      WHEN 'store'     THEN COALESCE(v_store_effective, v_retail_effective)
      ELSE                  v_retail_effective
    END;

    IF v_unit_price IS NULL OR v_unit_price <= 0 THEN
      RAISE EXCEPTION 'product missing valid price for tier %: %', v_tier, v_pid;
    END IF;

    INSERT INTO public.marketplace_order_items(order_id, product_id, qty, price_each)
    VALUES (v_order_id, v_pid, v_qty, v_unit_price);

    v_subtotal_server := v_subtotal_server + (v_unit_price * v_qty);
  END LOOP;

  IF p_discount_code IS NOT NULL AND length(trim(p_discount_code))>0 THEN
    SELECT * INTO v_discount
      FROM public.validate_discount(p_discount_code, NULLIF(p_customer_id, v_guest_bucket), p_guest_email);
    IF v_discount.valid THEN
      IF v_discount.type='percent' THEN
        v_discount_amount := round((v_subtotal_server * v_discount.value / 100)::numeric, 2);
      ELSE
        v_discount_amount := least(v_discount.value, v_subtotal_server);
      END IF;
    END IF;
  END IF;

  v_gross := GREATEST(0, v_subtotal_server - v_discount_amount);
  v_total := v_gross + COALESCE(p_shipping_cost,0) + COALESCE(p_tax_amount,0);

  IF p_ambassador_id IS NULL AND p_affiliate_code IS NOT NULL AND length(trim(p_affiliate_code))>0 THEN
    SELECT id, user_id, code, commission_rate INTO v_affiliate
      FROM public.dd_affiliates
     WHERE upper(code)=upper(trim(p_affiliate_code))
       AND status='active' LIMIT 1;
    IF v_affiliate.id IS NOT NULL
       AND (v_affiliate.user_id IS NULL OR v_affiliate.user_id <> v_user) THEN
      v_aff_id := v_affiliate.id;
      v_aff_rate := v_affiliate.commission_rate;
      v_aff_code := v_affiliate.code;
    END IF;
  END IF;

  UPDATE public.marketplace_orders
     SET subtotal        = v_subtotal_server,
         discount_amount = v_discount_amount,
         total           = v_total,
         affiliate_id    = v_aff_id,
         affiliate_code  = v_aff_code
   WHERE id = v_order_id;

  BEGIN v_routing := public.route_order_to_supplier(v_order_id);
  EXCEPTION WHEN OTHERS THEN v_routing := jsonb_build_object('error', SQLERRM); END;

  IF v_discount_amount > 0 AND p_discount_code IS NOT NULL THEN
    PERFORM public.increment_discount_usage(p_discount_code);
  END IF;

  BEGIN PERFORM public.dd_consume_order_reservations(v_order_id);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'subtotal', v_subtotal_server,
    'discount_amount', v_discount_amount,
    'total', v_total,
    'tier', v_tier,
    'routing', v_routing,
    'age_confirmed_at', v_age_at
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.dd_create_marketplace_order(jsonb, jsonb, text, text, uuid, numeric, numeric, numeric, text, text, text, uuid, uuid, timestamptz, text) TO anon, authenticated, service_role;