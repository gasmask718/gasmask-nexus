
-- ============================================================
-- DD Public-site adaptation: view+grants, trgm search, RPC payload
-- ============================================================

-- (1) products_all_public: add category column
DROP VIEW IF EXISTS public.products_all_public;
CREATE VIEW public.products_all_public
WITH (security_invoker = on) AS
SELECT
  id, wholesaler_id, brand_id,
  product_name, description, category, images,
  unit_type, inventory_qty, weight_oz, dimensions, retail_price,
  CASE
    WHEN auth.uid() IS NOT NULL AND (
      has_role(auth.uid(),'store'::app_role) OR has_role(auth.uid(),'wholesaler'::app_role)
      OR has_role(auth.uid(),'wholesale'::app_role) OR has_role(auth.uid(),'admin'::app_role)
      OR has_role(auth.uid(),'owner'::app_role)
    ) THEN store_price ELSE NULL::numeric
  END AS store_price,
  CASE
    WHEN auth.uid() IS NOT NULL AND (
      has_role(auth.uid(),'wholesaler'::app_role) OR has_role(auth.uid(),'wholesale'::app_role)
      OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role)
    ) THEN wholesale_price ELSE NULL::numeric
  END AS wholesale_price,
  street_price, shipping_from_city, shipping_from_state,
  processing_time, status, created_at
FROM public.products_all
WHERE status = 'active';

GRANT SELECT ON public.products_all_public TO anon, authenticated;

-- (2) Anon needs SELECT on the base table for direct queries (useBestsellers' "fresh").
-- RLS policy "Anyone can view active products" already gates rows to status='active'.
GRANT SELECT ON public.products_all TO anon;
GRANT SELECT ON public.brands TO anon;

-- (4) pg_trgm + GIN indexes for typo-tolerant search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS products_all_name_trgm
  ON public.products_all USING GIN (product_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_all_desc_trgm
  ON public.products_all USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_all_category_trgm
  ON public.products_all USING GIN (category gin_trgm_ops);

-- Search helper: anon-callable, returns active products ranked by trigram similarity.
-- Signature: public.search_products_public(p_q text, p_limit int default 40) RETURNS SETOF products_all_public
CREATE OR REPLACE FUNCTION public.search_products_public(p_q text, p_limit int DEFAULT 40)
RETURNS TABLE (
  id uuid, wholesaler_id uuid, brand_id uuid,
  product_name text, description text, category text, images jsonb,
  retail_price numeric, inventory_qty integer,
  shipping_from_city text, shipping_from_state text,
  created_at timestamptz, similarity real
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT p.id, p.wholesaler_id, p.brand_id,
         p.product_name, p.description, p.category, p.images,
         p.retail_price, p.inventory_qty,
         p.shipping_from_city, p.shipping_from_state, p.created_at,
         GREATEST(
           similarity(coalesce(p.product_name,''), p_q),
           similarity(coalesce(p.category,''),     p_q),
           similarity(coalesce(p.description,''),  p_q) * 0.5
         ) AS similarity
    FROM public.products_all p
   WHERE p.status = 'active'
     AND (
       p.product_name % p_q OR p.category % p_q OR p.description % p_q
       OR p.product_name ILIKE '%'||p_q||'%' OR p.category ILIKE '%'||p_q||'%'
     )
   ORDER BY similarity DESC, p.created_at DESC
   LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;
GRANT EXECUTE ON FUNCTION public.search_products_public(text,int) TO anon, authenticated;

-- (5) lookup_guest_order: add tracking_url (carrier-derived, public-safe).
-- Intentionally NOT exposing shipping_label_url (contains sender/recipient PII).
CREATE OR REPLACE FUNCTION public.lookup_guest_order(p_order_id uuid, p_email text, p_ip text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
           'product_name', coalesce(pa.product_name,'(item)'),
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
$$;
