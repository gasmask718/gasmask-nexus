-- Add ai_description and ai_description_short to products_all_public.
-- Preserves the explicit column list (no SELECT *) so sensitive fields
-- (supplier_cost, supplier_id, *_margin_pct, map_price, pricing_strategy,
-- market_*, brand_id, geo_blocked_states) cannot leak via schema drift.

DROP VIEW IF EXISTS public.products_all_public CASCADE;

CREATE VIEW public.products_all_public
WITH (security_invoker = true) AS
SELECT
  id,
  wholesaler_id,
  product_name,
  description,
  ai_description,
  ai_description_short,
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
  CASE WHEN auth.role() IN ('authenticated','service_role') THEN store_price END AS store_price,
  CASE WHEN auth.role() IN ('authenticated','service_role') THEN wholesale_price END AS wholesale_price,
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