CREATE OR REPLACE FUNCTION public.lookup_guest_order(p_order_id uuid, p_email text, p_ip text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ip_hash text;
  v_attempts int;
  v_order record;
  v_norm_email text;
  v_items jsonb;
  v_shipments jsonb;
BEGIN
  v_ip_hash := encode(digest(coalesce(p_ip,'')||':guest_lookup_salt_v1','sha256'),'hex');
  v_norm_email := lower(btrim(coalesce(p_email,'')));

  SELECT count(*) INTO v_attempts
    FROM public.guest_order_lookup_attempts
   WHERE ip_hash=v_ip_hash AND attempted_at > now() - interval '1 hour';

  IF v_attempts >= 10 THEN
    INSERT INTO public.guest_order_lookup_attempts(ip_hash,order_id,email_provided,success,rejected_reason)
    VALUES (v_ip_hash,p_order_id,v_norm_email,false,'rate_limited');
    RETURN '{}'::jsonb;
  END IF;

  IF p_order_id IS NULL OR v_norm_email = '' THEN
    INSERT INTO public.guest_order_lookup_attempts(ip_hash,order_id,email_provided,success,rejected_reason)
    VALUES (v_ip_hash,p_order_id,v_norm_email,false,'invalid_input');
    RETURN '{}'::jsonb;
  END IF;

  SELECT id, payment_status, fulfillment_status, subtotal, shipping_cost, tax_amount, total,
         created_at, shipping_address, customer_email
    INTO v_order
    FROM public.marketplace_orders
   WHERE id=p_order_id
     AND lower(btrim(coalesce(customer_email,''))) = v_norm_email
   LIMIT 1;

  IF v_order.id IS NULL THEN
    INSERT INTO public.guest_order_lookup_attempts(ip_hash,order_id,email_provided,success,rejected_reason)
    VALUES (v_ip_hash,p_order_id,v_norm_email,false,'no_match');
    RETURN '{}'::jsonb;
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'product_id', oi.product_id,
           'product_name', coalesce(pa.product_name,'(item)'),
           'qty', oi.qty,
           'price_each', oi.price_each,
           'image_url', CASE
             WHEN pa.images IS NULL OR jsonb_typeof(pa.images) <> 'array' OR jsonb_array_length(pa.images) = 0 THEN NULL
             WHEN jsonb_typeof(pa.images->0) = 'string' THEN pa.images->>0
             WHEN jsonb_typeof(pa.images->0) = 'object' THEN coalesce(pa.images->0->>'url', pa.images->0->>'src', pa.images->0->>'path')
             ELSE NULL
           END
         ) ORDER BY oi.created_at), '[]'::jsonb)
    INTO v_items
    FROM public.marketplace_order_items oi
    LEFT JOIN public.products_all pa ON pa.id = oi.product_id
   WHERE oi.order_id = v_order.id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'carrier', f.carrier,
           'tracking_number', f.tracking_number,
           'status', f.status,
           'tracking_url', CASE
             WHEN f.tracking_number IS NULL OR f.tracking_number='' THEN NULL
             WHEN lower(coalesce(f.carrier,'')) LIKE '%usps%'
               THEN 'https://tools.usps.com/go/TrackConfirmAction?tLabels='||f.tracking_number
             WHEN lower(coalesce(f.carrier,'')) LIKE '%ups%'
               THEN 'https://www.ups.com/track?tracknum='||f.tracking_number
             WHEN lower(coalesce(f.carrier,'')) LIKE '%fedex%'
               THEN 'https://www.fedex.com/fedextrack/?trknbr='||f.tracking_number
             WHEN lower(coalesce(f.carrier,'')) LIKE '%dhl%'
               THEN 'https://www.dhl.com/us-en/home/tracking.html?tracking-id='||f.tracking_number
             ELSE NULL
           END
         ) ORDER BY f.created_at), '[]'::jsonb)
    INTO v_shipments
    FROM public.marketplace_fulfillments f
   WHERE f.order_id = v_order.id;

  INSERT INTO public.guest_order_lookup_attempts(ip_hash,order_id,email_provided,success)
  VALUES (v_ip_hash,p_order_id,v_norm_email,true);

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'payment_status', v_order.payment_status,
    'fulfillment_status', v_order.fulfillment_status,
    'placed_at', v_order.created_at,
    'subtotal', v_order.subtotal,
    'shipping_cost', v_order.shipping_cost,
    'tax_amount', v_order.tax_amount,
    'total', v_order.total,
    'ship_to_city', v_order.shipping_address->>'city',
    'ship_to_state', v_order.shipping_address->>'state',
    'items', v_items,
    'shipments', v_shipments
  );
END;
$function$;