
CREATE OR REPLACE VIEW public.products_all_public AS
SELECT
  id, wholesaler_id, brand_id, product_name, description, category,
  images, unit_type, inventory_qty, weight_oz, dimensions, retail_price,
  CASE
    WHEN auth.uid() IS NOT NULL AND (
      public.has_role(auth.uid(), 'store'::public.app_role) OR
      public.has_role(auth.uid(), 'wholesaler'::public.app_role) OR
      public.has_role(auth.uid(), 'wholesale'::public.app_role) OR
      public.has_role(auth.uid(), 'admin'::public.app_role) OR
      public.has_role(auth.uid(), 'owner'::public.app_role)
    ) THEN store_price
    ELSE NULL::numeric
  END AS store_price,
  CASE
    WHEN auth.uid() IS NOT NULL AND (
      public.has_role(auth.uid(), 'wholesaler'::public.app_role) OR
      public.has_role(auth.uid(), 'wholesale'::public.app_role) OR
      public.has_role(auth.uid(), 'admin'::public.app_role) OR
      public.has_role(auth.uid(), 'owner'::public.app_role)
    ) THEN wholesale_price
    ELSE NULL::numeric
  END AS wholesale_price,
  street_price, shipping_from_city, shipping_from_state, processing_time,
  status, created_at, updated_at,
  has_variants, variant_types, review_count, avg_rating
FROM public.products_all
WHERE status = 'active';

GRANT SELECT ON public.products_all_public TO anon, authenticated;

ALTER TABLE public.dd_config
  ADD COLUMN IF NOT EXISTS loyalty_enabled bool NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS loyalty_points_per_dollar numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS loyalty_tier_silver int NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS loyalty_tier_gold int NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS loyalty_tier_platinum int NOT NULL DEFAULT 5000;
