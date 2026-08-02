DROP VIEW IF EXISTS public.products_public;
CREATE VIEW public.products_public AS
  SELECT id, wholesaler_id, brand_id, brand, brand_visible, product_name, description,
         ai_description, ai_description_short, seo_title, seo_keywords, key_features,
         images, image_urls, primary_image_url, category, item_type, package_text,
         flavor_or_variant, size_or_count, unit_type, inventory_qty, low_stock_threshold,
         track_inventory, min_order_qty, case_qty, units_per_case, has_variants, variant_types,
         weight_oz, length_in, width_in, height_in, is_fragile, stackable,
         shipping_from_city, shipping_from_state, processing_time,
         review_count, avg_rating, is_age_restricted, requires_pact_act, geo_blocked_states,
         status, created_at, updated_at, supplier_ships,
         retail_price, store_price, wholesale_price, street_price, case_price_store, map_price,
         store_price_a, dtc_price_b, retail_price_cents, store_price_cents,
         recognition
    FROM public.products_all
   WHERE status = 'active';

GRANT SELECT ON public.products_public TO anon, authenticated;