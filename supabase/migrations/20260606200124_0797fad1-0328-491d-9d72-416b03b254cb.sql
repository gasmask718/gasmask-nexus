-- Attempts log (admin/service only)
CREATE TABLE IF NOT EXISTS public.guest_order_lookup_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  order_id uuid,
  email_provided text,
  success boolean NOT NULL DEFAULT false,
  rejected_reason text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.guest_order_lookup_attempts TO service_role;
ALTER TABLE public.guest_order_lookup_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read lookup attempts"
  ON public.guest_order_lookup_attempts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_guest_lookup_ip_time
  ON public.guest_order_lookup_attempts (ip_hash, attempted_at DESC);

-- Lookup RPC
CREATE OR REPLACE FUNCTION public.lookup_guest_order(
  p_order_id uuid,
  p_email text,
  p_ip text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip_hash text;
  v_attempts int;
  v_order record;
  v_norm_email text;
  v_items jsonb;
  v_shipments jsonb;
BEGIN
  v_ip_hash := encode(digest(coalesce(p_ip, '') || ':guest_lookup_salt_v1', 'sha256'), 'hex');
  v_norm_email := lower(btrim(coalesce(p_email, '')));

  -- Rate limit: 10 / hour / ip
  SELECT count(*) INTO v_attempts
  FROM public.guest_order_lookup_attempts
  WHERE ip_hash = v_ip_hash
    AND attempted_at > now() - interval '1 hour';

  IF v_attempts >= 10 THEN
    INSERT INTO public.guest_order_lookup_attempts(ip_hash, order_id, email_provided, success, rejected_reason)
    VALUES (v_ip_hash, p_order_id, v_norm_email, false, 'rate_limited');
    RETURN '{}'::jsonb;
  END IF;

  IF p_order_id IS NULL OR v_norm_email = '' THEN
    INSERT INTO public.guest_order_lookup_attempts(ip_hash, order_id, email_provided, success, rejected_reason)
    VALUES (v_ip_hash, p_order_id, v_norm_email, false, 'invalid_input');
    RETURN '{}'::jsonb;
  END IF;

  SELECT id, payment_status, fulfillment_status, subtotal, shipping_cost, tax_amount, total,
         created_at, shipping_address, customer_email
    INTO v_order
    FROM public.marketplace_orders
   WHERE id = p_order_id
     AND lower(btrim(coalesce(customer_email, ''))) = v_norm_email
   LIMIT 1;

  IF v_order.id IS NULL THEN
    INSERT INTO public.guest_order_lookup_attempts(ip_hash, order_id, email_provided, success, rejected_reason)
    VALUES (v_ip_hash, p_order_id, v_norm_email, false, 'no_match');
    RETURN '{}'::jsonb;
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'product_name', coalesce(pa.product_name, '(item)'),
           'qty', oi.qty,
           'price_each', oi.price_each
         ) ORDER BY oi.created_at), '[]'::jsonb)
    INTO v_items
    FROM public.marketplace_order_items oi
    LEFT JOIN public.products_all pa ON pa.id = oi.product_id
   WHERE oi.order_id = v_order.id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'carrier', f.carrier,
           'tracking_number', f.tracking_number,
           'status', f.status
         ) ORDER BY f.created_at), '[]'::jsonb)
    INTO v_shipments
    FROM public.marketplace_fulfillments f
   WHERE f.order_id = v_order.id;

  INSERT INTO public.guest_order_lookup_attempts(ip_hash, order_id, email_provided, success)
  VALUES (v_ip_hash, p_order_id, v_norm_email, true);

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
$$;

REVOKE ALL ON FUNCTION public.lookup_guest_order(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_guest_order(uuid, text, text) TO anon, authenticated, service_role;