DROP VIEW IF EXISTS public.products_public;

CREATE VIEW public.products_public AS
SELECT
  id, wholesaler_id, brand_id, brand, brand_visible,
  product_name, description, ai_description, ai_description_short,
  seo_title, seo_keywords, key_features,
  images, image_urls, primary_image_url,
  category, item_type, package_text, flavor_or_variant, size_or_count, unit_type,
  inventory_qty, low_stock_threshold, track_inventory, min_order_qty,
  case_qty, units_per_case, has_variants, variant_types,
  weight_oz, length_in, width_in, height_in, is_fragile, stackable,
  shipping_from_city, shipping_from_state, processing_time,
  review_count, avg_rating,
  is_age_restricted, requires_pact_act, geo_blocked_states,
  status, created_at, updated_at, supplier_ships,
  dtc_price_b,
  retail_price,
  retail_price_cents
FROM public.products_all
WHERE status = 'active';

REVOKE ALL ON public.products_public FROM PUBLIC;
GRANT SELECT ON public.products_public TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.products_pricing_tiers AS
SELECT
  p.id,
  p.retail_price,
  p.dtc_price_b,
  p.store_price,
  p.store_price_a,
  p.wholesale_price,
  p.case_price_store
FROM public.products_all p
WHERE p.status = 'active'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('admin','owner','developer','staff','accountant','wholesaler','wholesale','store')
  );

REVOKE ALL ON public.products_pricing_tiers FROM PUBLIC, anon;
GRANT SELECT ON public.products_pricing_tiers TO authenticated, service_role;

UPDATE public.public_view_contracts
SET forbidden_columns = ARRAY[
      'store_price','store_price_a','store_price_cents','wholesale_price',
      'case_price_store','map_price','street_price','recognition',
      'supplier_cost','supplier_cost_cents','cost_cents','cost','margin_pct',
      'supplier_id','wholesale_cost_cents','profit_cents'
    ],
    notes = 'Storefront projection of products_all. DTC price only (dtc_price_b / retail_price). Store, wholesale, case, MAP, street pricing and AI recognition metadata are permanently out of contract — signed-in tier pricing lives in products_pricing_tiers.',
    updated_at = now()
WHERE view_name = 'products_public';

INSERT INTO public.public_view_contracts (view_name, allowed_privileges, public_roles, forbidden_columns, notes)
VALUES ('products_pricing_tiers', ARRAY['SELECT'], ARRAY['authenticated'], ARRAY[]::text[],
        'Signed-in tier pricing over products_all. Never anon. Rows are returned only to admin/owner/developer/staff/accountant/wholesaler/wholesale/store roles; retail shoppers get zero rows.')
ON CONFLICT DO NOTHING;