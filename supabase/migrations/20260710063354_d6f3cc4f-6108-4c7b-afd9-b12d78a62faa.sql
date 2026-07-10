DROP VIEW IF EXISTS public.products_all_public;

CREATE VIEW public.products_all_public
WITH (security_invoker = true) AS
SELECT
  id,
  wholesaler_id,
  product_name,
  description,
  category,
  images,
  primary_image_url,
  image_urls,
  unit_type,
  inventory_qty,
  min_order_qty,
  case_qty,
  case_price_store,
  weight_oz,
  dimensions,
  retail_price,
  street_price,
  dtc_price_b,
  store_price_a,
  CASE
    WHEN auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'store'::app_role)
      OR has_role(auth.uid(), 'wholesaler'::app_role)
      OR has_role(auth.uid(), 'wholesale'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'owner'::app_role)
    ) THEN store_price
    ELSE NULL::numeric
  END AS store_price,
  CASE
    WHEN auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'wholesaler'::app_role)
      OR has_role(auth.uid(), 'wholesale'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'owner'::app_role)
    ) THEN wholesale_price
    ELSE NULL::numeric
  END AS wholesale_price,
  shipping_from_city,
  shipping_from_state,
  processing_time,
  status,
  created_at,
  updated_at,
  has_variants,
  variant_types,
  review_count,
  avg_rating
FROM public.products_all
WHERE status = 'active';

GRANT SELECT ON public.products_all_public TO anon, authenticated;