
-- =========================================================
-- Fix #5: server-side price recomputation in dd_create_marketplace_order
-- =========================================================
CREATE OR REPLACE FUNCTION public.dd_create_marketplace_order(
  p_items jsonb,
  p_shipping_address jsonb,
  p_guest_email text DEFAULT NULL,
  p_guest_phone text DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL,
  p_subtotal numeric DEFAULT 0,        -- accepted for back-compat, IGNORED
  p_shipping_cost numeric DEFAULT 0,
  p_tax_amount numeric DEFAULT 0,
  p_notes text DEFAULT NULL,
  p_discount_code text DEFAULT NULL,
  p_affiliate_code text DEFAULT NULL,
  p_ambassador_id uuid DEFAULT NULL,
  p_ordering_store_id uuid DEFAULT NULL
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
  v_tier text;
  v_subtotal_server numeric := 0;
BEGIN
  v_user := COALESCE(p_customer_id, auth.uid(), v_guest_bucket);

  -- Resolve pricing tier from CALLER role, not from client input
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

  -- Create the order shell first; subtotal/total filled after recompute
  INSERT INTO public.marketplace_orders(
    user_id, customer_email, customer_phone, shipping_address,
    subtotal, shipping_cost, tax_amount, discount_code, discount_amount, total,
    payment_status, fulfillment_status, notes,
    ambassador_id, ordering_store_id
  ) VALUES (
    v_user, p_guest_email, p_guest_phone, p_shipping_address,
    0, COALESCE(p_shipping_cost,0), COALESCE(p_tax_amount,0),
    p_discount_code, 0, 0,
    'pending','pending', p_notes,
    p_ambassador_id, p_ordering_store_id
  ) RETURNING id INTO v_order_id;

  -- Recompute each line server-side from products_all
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := COALESCE((v_item->>'qty')::int, (v_item->>'quantity')::int, 0);
    IF v_pid IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'invalid line item: %', v_item;
    END IF;

    SELECT id, status, retail_price, store_price, wholesale_price
      INTO v_product
      FROM public.products_all
     WHERE id = v_pid;

    IF NOT FOUND OR v_product.status <> 'active' THEN
      RAISE EXCEPTION 'product not available: %', v_pid;
    END IF;

    v_unit_price := CASE v_tier
      WHEN 'wholesale' THEN COALESCE(v_product.wholesale_price, v_product.retail_price)
      WHEN 'store'     THEN COALESCE(v_product.store_price,     v_product.retail_price)
      ELSE                  v_product.retail_price
    END;

    IF v_unit_price IS NULL OR v_unit_price <= 0 THEN
      RAISE EXCEPTION 'product missing valid price for tier %: %', v_tier, v_pid;
    END IF;

    INSERT INTO public.marketplace_order_items(order_id, product_id, qty, price_each)
    VALUES (v_order_id, v_pid, v_qty, v_unit_price);

    v_subtotal_server := v_subtotal_server + (v_unit_price * v_qty);
  END LOOP;

  -- Discount eval (uses server subtotal)
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

  -- Affiliate resolution (self-attribution guarded)
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

  -- Routing + reservations (unchanged behaviour, soft-failure)
  BEGIN v_routing := public.route_order_to_supplier(v_order_id);
  EXCEPTION WHEN OTHERS THEN v_routing := jsonb_build_object('error', SQLERRM); END;

  IF v_discount_amount > 0 AND p_discount_code IS NOT NULL THEN
    PERFORM public.increment_discount_usage(p_discount_code);
  END IF;

  BEGIN PERFORM public.dd_consume_order_reservations(v_order_id);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  IF v_aff_id IS NOT NULL THEN
    v_commission := round((v_gross * v_aff_rate)::numeric, 2);
    INSERT INTO public.dd_affiliate_events(
      affiliate_id, kind, status, order_id, amount, commission_rate, commission_amount
    ) VALUES (
      v_aff_id, 'order', 'pending', v_order_id, v_gross, v_aff_rate, v_commission
    );
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
      p_ambassador_id, p_ordering_store_id, 'dynasty_direct', v_order_id, 'DD Order',
      v_gross, v_amb_rate, v_amb_commission, 'pending', now()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'subtotal', v_subtotal_server,
    'total', v_total,
    'discount_amount', v_discount_amount,
    'pricing_tier', v_tier,
    'affiliate_commission', v_commission,
    'ambassador_commission', v_amb_commission,
    'routing', v_routing
  );
END $function$;

-- =========================================================
-- Fix #6: column-masking view for public catalog reads
-- Masks store_price + wholesale_price to NULL unless caller
-- is store / wholesaler / admin / owner. Base table grants
-- are unchanged so the public site keeps working while it
-- migrates PRODUCT_SELECT to this view; the anon SELECT on
-- the two sensitive columns can then be revoked safely.
-- =========================================================
CREATE OR REPLACE VIEW public.products_all_public
WITH (security_invoker = on) AS
SELECT
  id,
  wholesaler_id,
  brand_id,
  product_name,
  description,
  images,
  unit_type,
  inventory_qty,
  weight_oz,
  dimensions,
  retail_price,
  CASE
    WHEN auth.uid() IS NOT NULL AND (
         public.has_role(auth.uid(), 'store'::app_role)
      OR public.has_role(auth.uid(), 'wholesaler'::app_role)
      OR public.has_role(auth.uid(), 'wholesale'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'owner'::app_role)
    )
    THEN store_price
    ELSE NULL
  END AS store_price,
  CASE
    WHEN auth.uid() IS NOT NULL AND (
         public.has_role(auth.uid(), 'wholesaler'::app_role)
      OR public.has_role(auth.uid(), 'wholesale'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'owner'::app_role)
    )
    THEN wholesale_price
    ELSE NULL
  END AS wholesale_price,
  street_price,
  shipping_from_city,
  shipping_from_state,
  processing_time,
  status,
  created_at
FROM public.products_all
WHERE status = 'active';

GRANT SELECT ON public.products_all_public TO anon, authenticated;

COMMENT ON VIEW public.products_all_public IS
  'Public catalog projection. Masks store_price/wholesale_price to NULL '
  'for callers who are not store/wholesaler/admin/owner. After the public '
  'site migrates PRODUCT_SELECT to read from this view, run: '
  'REVOKE SELECT (store_price, wholesale_price) ON public.products_all FROM anon;';
