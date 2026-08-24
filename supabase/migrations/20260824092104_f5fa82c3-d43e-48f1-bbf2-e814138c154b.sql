-- ═══ 1) Safe per-wholesaler product view (no retail/margin/market columns) ═══
CREATE OR REPLACE VIEW public.dd_wholesaler_products_safe AS
SELECT
  p.id, p.wholesaler_id, p.brand_id, p.product_name, p.description,
  p.images, p.primary_image_url, p.image_urls,
  p.category, p.unit_type, p.item_type, p.package_text, p.flavor_or_variant, p.size_or_count,
  p.key_features, p.brand, p.brand_visible,
  p.inventory_qty, p.low_stock_threshold, p.track_inventory, p.min_order_qty,
  p.case_qty, p.units_per_case, p.has_variants, p.variant_types,
  p.weight_oz, p.length_in, p.width_in, p.height_in, p.dimensions,
  p.case_length_in, p.case_width_in, p.case_height_in, p.case_weight_oz,
  p.is_fragile, p.stackable, p.supplier_ships,
  p.supplier_cost, p.supplier_cost_cents,
  p.shipping_from_city, p.shipping_from_state, p.processing_time,
  p.status, p.created_at, p.updated_at
FROM public.products_all p
WHERE p.wholesaler_id IN (
  SELECT wp.id FROM public.wholesaler_profiles wp WHERE wp.user_id = auth.uid()
);

GRANT SELECT ON public.dd_wholesaler_products_safe TO authenticated;
GRANT ALL ON public.dd_wholesaler_products_safe TO service_role;

-- ═══ 2) Trigger: platform pricing fields are admin/finance/service-role only ═══
CREATE OR REPLACE FUNCTION public.dd_protect_platform_pricing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_privileged boolean;
BEGIN
  -- Service role / background workers (no JWT) always allowed.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_privileged := has_role(auth.uid(), 'admin'::app_role)
               OR has_role(auth.uid(), 'owner'::app_role)
               OR has_finance_access(auth.uid());
  IF v_privileged THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.retail_price IS NOT NULL OR NEW.store_price IS NOT NULL
       OR NEW.wholesale_price IS NOT NULL OR NEW.street_price IS NOT NULL
       OR NEW.store_price_a IS NOT NULL OR NEW.dtc_price_b IS NOT NULL
       OR NEW.map_price IS NOT NULL OR NEW.case_price_store IS NOT NULL
       OR NEW.retail_price_cents IS NOT NULL OR NEW.store_price_cents IS NOT NULL
       OR NEW.store_margin_pct IS NOT NULL OR NEW.dtc_margin_pct IS NOT NULL
       OR NEW.min_store_margin_pct IS NOT NULL OR NEW.target_store_margin_pct IS NOT NULL
       OR NEW.min_dtc_margin_pct IS NOT NULL OR NEW.target_dtc_margin_pct IS NOT NULL
       OR NEW.market_avg_retail IS NOT NULL OR NEW.market_low_retail IS NOT NULL
       OR NEW.market_high_retail IS NOT NULL OR NEW.pricing_strategy IS NOT NULL THEN
      RAISE EXCEPTION 'Platform pricing is set by Dynasty during admin review. Enter only your supplier cost.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.retail_price IS DISTINCT FROM OLD.retail_price
       OR NEW.store_price IS DISTINCT FROM OLD.store_price
       OR NEW.wholesale_price IS DISTINCT FROM OLD.wholesale_price
       OR NEW.street_price IS DISTINCT FROM OLD.street_price
       OR NEW.store_price_a IS DISTINCT FROM OLD.store_price_a
       OR NEW.dtc_price_b IS DISTINCT FROM OLD.dtc_price_b
       OR NEW.map_price IS DISTINCT FROM OLD.map_price
       OR NEW.case_price_store IS DISTINCT FROM OLD.case_price_store
       OR NEW.retail_price_cents IS DISTINCT FROM OLD.retail_price_cents
       OR NEW.store_price_cents IS DISTINCT FROM OLD.store_price_cents
       OR NEW.store_margin_pct IS DISTINCT FROM OLD.store_margin_pct
       OR NEW.dtc_margin_pct IS DISTINCT FROM OLD.dtc_margin_pct
       OR NEW.min_store_margin_pct IS DISTINCT FROM OLD.min_store_margin_pct
       OR NEW.target_store_margin_pct IS DISTINCT FROM OLD.target_store_margin_pct
       OR NEW.min_dtc_margin_pct IS DISTINCT FROM OLD.min_dtc_margin_pct
       OR NEW.target_dtc_margin_pct IS DISTINCT FROM OLD.target_dtc_margin_pct
       OR NEW.market_avg_retail IS DISTINCT FROM OLD.market_avg_retail
       OR NEW.market_low_retail IS DISTINCT FROM OLD.market_low_retail
       OR NEW.market_high_retail IS DISTINCT FROM OLD.market_high_retail
       OR NEW.pricing_strategy IS DISTINCT FROM OLD.pricing_strategy THEN
      RAISE EXCEPTION 'Platform pricing is set by Dynasty during admin review. You can edit your supplier cost and product details only.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS dd_protect_platform_pricing ON public.products_all;
CREATE TRIGGER dd_protect_platform_pricing
  BEFORE INSERT OR UPDATE ON public.products_all
  FOR EACH ROW EXECUTE FUNCTION public.dd_protect_platform_pricing();

-- ═══ 3) products_all RLS: wholesalers read via the safe view only ═══
DROP POLICY "Staff read full product economics" ON public.products_all;
CREATE POLICY "Staff read full product economics" ON public.products_all
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_finance_access(auth.uid()));

DROP POLICY "Wholesalers manage own products" ON public.products_all;
CREATE POLICY "Wholesalers insert own products" ON public.products_all
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.wholesaler_profiles wp
    WHERE wp.id = products_all.wholesaler_id AND wp.user_id = auth.uid()
  ));
CREATE POLICY "Wholesalers update own products" ON public.products_all
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.wholesaler_profiles wp
    WHERE wp.id = products_all.wholesaler_id AND wp.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.wholesaler_profiles wp
    WHERE wp.id = products_all.wholesaler_id AND wp.user_id = auth.uid()
  ));
CREATE POLICY "Wholesalers delete own products" ON public.products_all
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.wholesaler_profiles wp
    WHERE wp.id = products_all.wholesaler_id AND wp.user_id = auth.uid()
  ));

-- ═══ 4) Margin overrides: kill the any-authenticated read ═══
DROP POLICY "margin overrides authed read" ON public.dd_product_margin_overrides;
CREATE POLICY "margin overrides finance read" ON public.dd_product_margin_overrides
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'owner'::app_role)
      OR has_finance_access(auth.uid()));

-- ═══ 5) Shipping tables: wholesaler-scoped, admin-managed ═══
DROP POLICY "Authenticated can read shipments" ON public.dd_shipments;
DROP POLICY "Authenticated can manage shipments" ON public.dd_shipments;
CREATE POLICY "Wholesalers read own shipments" ON public.dd_shipments
  FOR SELECT TO authenticated
  USING (wholesaler_id IN (
    SELECT wp.id FROM public.wholesaler_profiles wp WHERE wp.user_id = auth.uid()
  ));
CREATE POLICY "Admins manage shipments" ON public.dd_shipments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

DROP POLICY "Authenticated can read shipping accounts" ON public.dd_shipping_accounts;
DROP POLICY "Authenticated can manage shipping accounts" ON public.dd_shipping_accounts;
CREATE POLICY "Wholesalers read own shipping account" ON public.dd_shipping_accounts
  FOR SELECT TO authenticated
  USING (wholesaler_id IN (
    SELECT wp.id FROM public.wholesaler_profiles wp WHERE wp.user_id = auth.uid()
  ));
CREATE POLICY "Admins manage shipping accounts" ON public.dd_shipping_accounts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

DROP POLICY "Authenticated can read pickup schedules" ON public.dd_pickup_schedules;
DROP POLICY "Authenticated can manage pickup schedules" ON public.dd_pickup_schedules;
CREATE POLICY "Wholesalers read own pickups" ON public.dd_pickup_schedules
  FOR SELECT TO authenticated
  USING (wholesaler_id IN (
    SELECT wp.id FROM public.wholesaler_profiles wp WHERE wp.user_id = auth.uid()
  ));
CREATE POLICY "Admins manage pickup schedules" ON public.dd_pickup_schedules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));