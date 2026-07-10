-- Rebuild products_all_public with an explicit safe-only column list.
-- Adds missing public columns (dtc_price_b, store_price_a, primary_image_url, image_urls)
-- and removes brand_id. Sensitive columns (supplier_cost, margins, supplier_id, map_price,
-- pricing_strategy, market_*, geo_blocked_states) remain excluded by design.
-- Uses DROP + CREATE (not CREATE OR REPLACE) because column shape changes.

DROP VIEW IF EXISTS public.products_all_public CASCADE;

CREATE VIEW public.products_all_public
WITH (security_invoker = true) AS
SELECT
  -- Identity
  id,
  wholesaler_id,

  -- Public product info
  product_name,
  description,
  category,

  -- Images (both legacy and new columns exposed)
  images,
  primary_image_url,
  image_urls,

  -- Physical
  unit_type,
  inventory_qty,
  weight_oz,
  dimensions,

  -- Prices safe for public / logged-in shoppers
  retail_price,
  street_price,
  dtc_price_b,
  store_price_a,

  -- Role-gated prices (kept from original behavior)
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

  -- Shipping / fulfillment
  shipping_from_city,
  shipping_from_state,
  processing_time,

  -- Status / timestamps
  status,
  created_at,
  updated_at,

  -- Variants / reviews
  has_variants,
  variant_types,
  review_count,
  avg_rating
FROM public.products_all
WHERE status = 'active'::text;

-- Restore public read access (view has no RLS itself; base table RLS still applies via security_invoker)
GRANT SELECT ON public.products_all_public TO anon, authenticated;
