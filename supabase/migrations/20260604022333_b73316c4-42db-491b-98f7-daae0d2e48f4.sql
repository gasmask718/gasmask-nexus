
CREATE OR REPLACE FUNCTION public.dd_create_marketplace_order(
  p_items jsonb, p_shipping_address jsonb,
  p_guest_email text DEFAULT NULL, p_guest_phone text DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL,
  p_subtotal numeric DEFAULT 0, p_shipping_cost numeric DEFAULT 0, p_tax_amount numeric DEFAULT 0,
  p_notes text DEFAULT NULL, p_discount_code text DEFAULT NULL, p_affiliate_code text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_order_id uuid; v_user uuid;
  v_guest_bucket constant uuid := '00000000-0000-0000-0000-000000000001';
  v_item jsonb; v_discount_amount numeric := 0; v_discount record;
  v_total numeric; v_routing jsonb := '[]'::jsonb; v_route jsonb;
  v_affiliate record; v_commission numeric := 0; v_aff_id uuid; v_aff_rate numeric;
BEGIN
  v_user := COALESCE(p_customer_id, auth.uid(), v_guest_bucket);

  IF p_discount_code IS NOT NULL AND length(trim(p_discount_code))>0 THEN
    SELECT * INTO v_discount FROM public.validate_discount(p_discount_code, NULLIF(p_customer_id, v_guest_bucket), p_guest_email);
    IF v_discount.valid THEN
      IF v_discount.type='percent' THEN v_discount_amount := round((p_subtotal * v_discount.value / 100)::numeric, 2);
      ELSE v_discount_amount := least(v_discount.value, p_subtotal); END IF;
    END IF;
  END IF;

  IF p_affiliate_code IS NOT NULL AND length(trim(p_affiliate_code))>0 THEN
    SELECT id, user_id, code, commission_rate INTO v_affiliate
      FROM public.dd_affiliates
      WHERE upper(code)=upper(trim(p_affiliate_code)) AND status='active' LIMIT 1;
    IF v_affiliate.id IS NOT NULL AND v_affiliate.user_id IS NOT NULL AND v_affiliate.user_id = v_user THEN
      v_aff_id := NULL;
    ELSE v_aff_id := v_affiliate.id; v_aff_rate := v_affiliate.commission_rate; END IF;
  END IF;

  v_total := GREATEST(0, p_subtotal - v_discount_amount) + COALESCE(p_shipping_cost,0) + COALESCE(p_tax_amount,0);

  INSERT INTO public.marketplace_orders(
    user_id, customer_email, customer_phone, shipping_address,
    subtotal, shipping_cost, tax_amount, discount_code, discount_amount, total,
    payment_status, fulfillment_status, notes, affiliate_id, affiliate_code
  ) VALUES (
    v_user, p_guest_email, p_guest_phone, p_shipping_address,
    p_subtotal, p_shipping_cost, p_tax_amount, p_discount_code, v_discount_amount, v_total,
    'pending','pending', p_notes,
    v_aff_id, CASE WHEN v_aff_id IS NOT NULL THEN v_affiliate.code ELSE NULL END
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.marketplace_order_items(order_id, product_id, quantity, unit_price, subtotal)
    VALUES (v_order_id, (v_item->>'product_id')::uuid, (v_item->>'quantity')::int,
            (v_item->>'unit_price')::numeric,
            ((v_item->>'quantity')::int * (v_item->>'unit_price')::numeric));
    BEGIN
      v_route := public.route_order_to_supplier(v_order_id, (v_item->>'product_id')::uuid, (v_item->>'quantity')::int);
      v_routing := v_routing || jsonb_build_array(v_route);
    EXCEPTION WHEN OTHERS THEN
      v_routing := v_routing || jsonb_build_array(jsonb_build_object('error', SQLERRM,'product_id',v_item->>'product_id'));
    END;
  END LOOP;

  IF v_discount_amount > 0 AND p_discount_code IS NOT NULL THEN
    PERFORM public.increment_discount_usage(p_discount_code);
  END IF;

  BEGIN PERFORM public.dd_consume_order_reservations(v_order_id);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  IF v_aff_id IS NOT NULL THEN
    v_commission := round(((GREATEST(0, p_subtotal - v_discount_amount)) * v_aff_rate)::numeric, 2);
    INSERT INTO public.dd_affiliate_events(affiliate_id, kind, status, order_id, amount, commission_rate, commission_amount)
      VALUES (v_aff_id, 'order', 'pending', v_order_id,
              GREATEST(0, p_subtotal - v_discount_amount), v_aff_rate, v_commission);
    UPDATE public.dd_affiliates SET conversions = conversions + 1 WHERE id = v_aff_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'order_id', v_order_id, 'total', v_total,
    'discount_amount', v_discount_amount,
    'affiliate', CASE WHEN v_aff_id IS NOT NULL THEN jsonb_build_object(
      'affiliate_id', v_aff_id, 'code', v_affiliate.code,
      'commission_rate', v_aff_rate, 'commission_amount', v_commission) ELSE NULL END,
    'routing', v_routing);
END $$;
GRANT EXECUTE ON FUNCTION public.dd_create_marketplace_order(jsonb,jsonb,text,text,uuid,numeric,numeric,numeric,text,text,text) TO anon, authenticated, service_role;
