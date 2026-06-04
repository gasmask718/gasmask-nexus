
CREATE OR REPLACE FUNCTION public.dd_create_marketplace_order(
  p_items jsonb, p_shipping_address jsonb,
  p_guest_email text DEFAULT NULL, p_guest_phone text DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL,
  p_subtotal numeric DEFAULT 0, p_shipping_cost numeric DEFAULT 0, p_tax_amount numeric DEFAULT 0,
  p_notes text DEFAULT NULL, p_discount_code text DEFAULT NULL, p_affiliate_code text DEFAULT NULL,
  p_ambassador_id uuid DEFAULT NULL, p_ordering_store_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_order_id uuid; v_user uuid;
  v_guest_bucket constant uuid := '00000000-0000-0000-0000-000000000001';
  v_item jsonb; v_discount_amount numeric := 0; v_discount record;
  v_total numeric; v_routing jsonb := '[]'::jsonb; v_route jsonb;
  v_affiliate record; v_commission numeric := 0; v_aff_id uuid; v_aff_rate numeric; v_aff_code text;
  v_amb_rate numeric; v_amb_commission numeric := 0; v_amb_ledger_id uuid;
  v_gross numeric;
BEGIN
  v_user := COALESCE(p_customer_id, auth.uid(), v_guest_bucket);
  IF p_discount_code IS NOT NULL AND length(trim(p_discount_code))>0 THEN
    SELECT * INTO v_discount FROM public.validate_discount(p_discount_code, NULLIF(p_customer_id, v_guest_bucket), p_guest_email);
    IF v_discount.valid THEN
      IF v_discount.type='percent' THEN v_discount_amount := round((p_subtotal * v_discount.value / 100)::numeric, 2);
      ELSE v_discount_amount := least(v_discount.value, p_subtotal); END IF;
    END IF;
  END IF;
  IF p_ambassador_id IS NULL AND p_affiliate_code IS NOT NULL AND length(trim(p_affiliate_code))>0 THEN
    SELECT id, user_id, code, commission_rate INTO v_affiliate
      FROM public.dd_affiliates WHERE upper(code)=upper(trim(p_affiliate_code)) AND status='active' LIMIT 1;
    IF v_affiliate.id IS NOT NULL AND (v_affiliate.user_id IS NULL OR v_affiliate.user_id <> v_user) THEN
      v_aff_id := v_affiliate.id; v_aff_rate := v_affiliate.commission_rate; v_aff_code := v_affiliate.code;
    END IF;
  END IF;
  v_total := GREATEST(0, p_subtotal - v_discount_amount) + COALESCE(p_shipping_cost,0) + COALESCE(p_tax_amount,0);
  v_gross := GREATEST(0, p_subtotal - v_discount_amount);
  INSERT INTO public.marketplace_orders(
    user_id, customer_email, customer_phone, shipping_address,
    subtotal, shipping_cost, tax_amount, discount_code, discount_amount, total,
    payment_status, fulfillment_status, notes, affiliate_id, affiliate_code,
    ambassador_id, ordering_store_id
  ) VALUES (
    v_user, p_guest_email, p_guest_phone, p_shipping_address,
    p_subtotal, p_shipping_cost, p_tax_amount, p_discount_code, v_discount_amount, v_total,
    'pending','pending', p_notes, v_aff_id, v_aff_code, p_ambassador_id, p_ordering_store_id
  ) RETURNING id INTO v_order_id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.marketplace_order_items(order_id, product_id, qty, price_each)
    VALUES (v_order_id, (v_item->>'product_id')::uuid, (v_item->>'quantity')::int, (v_item->>'unit_price')::numeric);
    BEGIN
      v_route := public.route_order_to_supplier(v_order_id, (v_item->>'product_id')::uuid, (v_item->>'quantity')::int);
      v_routing := v_routing || jsonb_build_array(v_route);
    EXCEPTION WHEN OTHERS THEN
      v_routing := v_routing || jsonb_build_array(jsonb_build_object('error', SQLERRM,'product_id',v_item->>'product_id'));
    END;
  END LOOP;
  IF v_discount_amount > 0 AND p_discount_code IS NOT NULL THEN PERFORM public.increment_discount_usage(p_discount_code); END IF;
  BEGIN PERFORM public.dd_consume_order_reservations(v_order_id); EXCEPTION WHEN OTHERS THEN NULL; END;
  IF v_aff_id IS NOT NULL THEN
    v_commission := round((v_gross * v_aff_rate)::numeric, 2);
    INSERT INTO public.dd_affiliate_events(affiliate_id, kind, status, order_id, amount, commission_rate, commission_amount)
      VALUES (v_aff_id, 'order', 'pending', v_order_id, v_gross, v_aff_rate, v_commission);
    UPDATE public.dd_affiliates SET conversions = conversions + 1 WHERE id = v_aff_id;
  END IF;
  IF p_ambassador_id IS NOT NULL THEN
    SELECT COALESCE((value->>'rate')::numeric, 0.05) INTO v_amb_rate
      FROM public.marketplace_config WHERE key = 'dd_ambassador_commission_rate';
    v_amb_rate := COALESCE(v_amb_rate, 0.05);
    v_amb_commission := round((v_gross * v_amb_rate)::numeric, 2);
    INSERT INTO public.commission_ledger(
      ambassador_id, store_id, source_channel, source_id, source_name,
      gross_amount, commission_rate, commission_amount, status, earned_at
    ) VALUES (
      p_ambassador_id, p_ordering_store_id, 'dynasty_direct', v_order_id,
      'Dynasty Direct order ' || substring(v_order_id::text, 1, 8),
      v_gross, v_amb_rate, v_amb_commission, 'pending', now()
    ) RETURNING id INTO v_amb_ledger_id;
  END IF;
  RETURN jsonb_build_object(
    'success', true, 'order_id', v_order_id, 'total', v_total, 'discount_amount', v_discount_amount,
    'affiliate', CASE WHEN v_aff_id IS NOT NULL THEN jsonb_build_object('affiliate_id', v_aff_id, 'code', v_aff_code, 'commission_rate', v_aff_rate, 'commission_amount', v_commission) ELSE NULL END,
    'ambassador', CASE WHEN p_ambassador_id IS NOT NULL THEN jsonb_build_object('ambassador_id', p_ambassador_id, 'commission_ledger_id', v_amb_ledger_id, 'commission_rate', v_amb_rate, 'commission_amount', v_amb_commission) ELSE NULL END,
    'routing', v_routing);
END $function$;
