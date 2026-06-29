
-- 1. PRODUCT VARIANTS
CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products_all(id) ON DELETE CASCADE,
  sku text UNIQUE,
  variant_name text NOT NULL,
  attributes jsonb NOT NULL DEFAULT '{}',
  price_retail numeric,
  price_store numeric,
  inventory_qty int NOT NULL DEFAULT 0,
  track_inventory bool NOT NULL DEFAULT true,
  weight_oz numeric,
  is_default bool NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','out_of_stock')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_variants TO anon, authenticated;
GRANT ALL ON public.product_variants TO service_role;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active variants" ON public.product_variants FOR SELECT USING (status = 'active');
CREATE POLICY "Admin full access variants" ON public.product_variants FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS product_variants_product_id_idx ON public.product_variants(product_id);

-- 2. PRODUCT VARIANT OPTIONS
CREATE TABLE IF NOT EXISTS public.product_variant_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products_all(id) ON DELETE CASCADE,
  attribute_name text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]',
  display_type text NOT NULL DEFAULT 'buttons' CHECK (display_type IN ('buttons','dropdown','swatches')),
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE(product_id, attribute_name)
);
GRANT SELECT ON public.product_variant_options TO anon, authenticated;
GRANT ALL ON public.product_variant_options TO service_role;
ALTER TABLE public.product_variant_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read variant options" ON public.product_variant_options FOR SELECT USING (true);
CREATE POLICY "Admin full access options" ON public.product_variant_options FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3. PRODUCT REVIEWS
CREATE TABLE IF NOT EXISTS public.dd_product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products_all(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  order_id uuid REFERENCES public.marketplace_orders(id),
  reviewer_name text NOT NULL,
  reviewer_email text,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text,
  body text,
  verified_purchase bool DEFAULT false,
  helpful_count int DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','flagged')),
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.dd_product_reviews TO anon, authenticated;
GRANT INSERT, UPDATE ON public.dd_product_reviews TO authenticated;
GRANT ALL ON public.dd_product_reviews TO service_role;
ALTER TABLE public.dd_product_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read approved reviews" ON public.dd_product_reviews FOR SELECT USING (status = 'approved');
CREATE POLICY "Auth users insert own review" ON public.dd_product_reviews FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin full access reviews" ON public.dd_product_reviews FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4. CUSTOM PRICING
CREATE TABLE IF NOT EXISTS public.dd_custom_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid REFERENCES public.store_accounts(id),
  pricing_tier text,
  product_id uuid REFERENCES public.products_all(id),
  category text,
  price_override numeric,
  discount_pct numeric,
  min_qty_for_price int DEFAULT 1,
  valid_from date,
  valid_until date,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_custom_pricing TO authenticated;
GRANT ALL ON public.dd_custom_pricing TO service_role;
ALTER TABLE public.dd_custom_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access pricing" ON public.dd_custom_pricing FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5. LOYALTY ACCOUNTS
CREATE TABLE IF NOT EXISTS public.dd_loyalty_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid UNIQUE REFERENCES public.store_accounts(id),
  user_id uuid REFERENCES auth.users(id),
  points_balance int DEFAULT 0,
  points_lifetime int DEFAULT 0,
  tier text DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','platinum')),
  tier_updated_at timestamptz,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.dd_loyalty_accounts TO authenticated;
GRANT ALL ON public.dd_loyalty_accounts TO service_role;
ALTER TABLE public.dd_loyalty_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stores view own loyalty" ON public.dd_loyalty_accounts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admin full access loyalty" ON public.dd_loyalty_accounts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6. LOYALTY TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.dd_loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loyalty_account_id uuid REFERENCES public.dd_loyalty_accounts(id),
  order_id uuid,
  transaction_type text CHECK (transaction_type IN ('earn','redeem','expire','adjust')),
  points int NOT NULL,
  balance_after int,
  description text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.dd_loyalty_transactions TO authenticated;
GRANT ALL ON public.dd_loyalty_transactions TO service_role;
ALTER TABLE public.dd_loyalty_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stores view own transactions" ON public.dd_loyalty_transactions FOR SELECT TO authenticated
  USING (loyalty_account_id IN (SELECT id FROM public.dd_loyalty_accounts WHERE user_id = auth.uid()));
CREATE POLICY "Admin full access loyalty tx" ON public.dd_loyalty_transactions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 7. STORE ORDER TEMPLATES
CREATE TABLE IF NOT EXISTS public.store_order_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  total_items int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_order_templates TO authenticated;
GRANT ALL ON public.store_order_templates TO service_role;
ALTER TABLE public.store_order_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own templates" ON public.store_order_templates FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- MISSING COLUMNS ON PRODUCTS_ALL
ALTER TABLE public.products_all
  ADD COLUMN IF NOT EXISTS has_variants bool NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS variant_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS review_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_rating numeric DEFAULT 0;

-- FUNCTIONS
CREATE OR REPLACE FUNCTION public.dd_update_product_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products_all
  SET
    review_count = (SELECT COUNT(*) FROM public.dd_product_reviews WHERE product_id = NEW.product_id AND status = 'approved'),
    avg_rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM public.dd_product_reviews WHERE product_id = NEW.product_id AND status = 'approved'), 0)
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dd_review_rating_trigger ON public.dd_product_reviews;
CREATE TRIGGER dd_review_rating_trigger
AFTER INSERT OR UPDATE ON public.dd_product_reviews
FOR EACH ROW EXECUTE FUNCTION public.dd_update_product_rating();

CREATE OR REPLACE FUNCTION public.dd_get_store_price(
  p_product_id uuid,
  p_user_id uuid,
  p_quantity int DEFAULT 1
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_base_price numeric;
  v_custom public.dd_custom_pricing%ROWTYPE;
BEGIN
  SELECT sa.id INTO v_store_id FROM public.store_accounts sa WHERE sa.user_id = p_user_id LIMIT 1;
  SELECT COALESCE(store_price, retail_price) INTO v_base_price FROM public.products_all WHERE id = p_product_id;
  SELECT * INTO v_custom FROM public.dd_custom_pricing
  WHERE (store_account_id = v_store_id OR store_account_id IS NULL)
    AND (product_id = p_product_id OR product_id IS NULL)
    AND (valid_from IS NULL OR valid_from <= now()::date)
    AND (valid_until IS NULL OR valid_until >= now()::date)
    AND p_quantity >= COALESCE(min_qty_for_price, 1)
  ORDER BY
    CASE WHEN store_account_id IS NOT NULL THEN 0 ELSE 1 END,
    CASE WHEN product_id IS NOT NULL THEN 0 ELSE 1 END
  LIMIT 1;
  IF FOUND THEN
    IF v_custom.price_override IS NOT NULL THEN RETURN v_custom.price_override;
    ELSIF v_custom.discount_pct IS NOT NULL THEN
      RETURN ROUND(v_base_price * (1 - v_custom.discount_pct / 100), 2);
    END IF;
  END IF;
  RETURN v_base_price;
END;
$$;

CREATE OR REPLACE FUNCTION public.dd_earn_loyalty_points(
  p_user_id uuid,
  p_order_id uuid,
  p_order_total numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account public.dd_loyalty_accounts%ROWTYPE;
  v_points int;
  v_new_tier text;
BEGIN
  v_points := FLOOR(p_order_total);
  SELECT * INTO v_account FROM public.dd_loyalty_accounts WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    INSERT INTO public.dd_loyalty_accounts (user_id, points_balance, points_lifetime)
    VALUES (p_user_id, v_points, v_points)
    RETURNING * INTO v_account;
  ELSE
    UPDATE public.dd_loyalty_accounts
    SET points_balance = points_balance + v_points,
        points_lifetime = points_lifetime + v_points
    WHERE id = v_account.id
    RETURNING * INTO v_account;
  END IF;
  INSERT INTO public.dd_loyalty_transactions (loyalty_account_id, order_id, transaction_type, points, balance_after, description)
  VALUES (v_account.id, p_order_id, 'earn', v_points, v_account.points_balance, 'Order #' || p_order_id);
  v_new_tier := CASE
    WHEN v_account.points_lifetime >= 5000 THEN 'platinum'
    WHEN v_account.points_lifetime >= 2000 THEN 'gold'
    WHEN v_account.points_lifetime >= 500 THEN 'silver'
    ELSE 'bronze'
  END;
  IF v_new_tier != v_account.tier THEN
    UPDATE public.dd_loyalty_accounts SET tier = v_new_tier, tier_updated_at = now() WHERE id = v_account.id;
  END IF;
END;
$$;

-- SEED VARIANT DATA
WITH p AS (SELECT id FROM public.products_all WHERE status = 'active' LIMIT 1)
INSERT INTO public.product_variant_options (product_id, attribute_name, options, display_type, sort_order)
SELECT p.id, 'Size', '["S","M","L","XL"]'::jsonb, 'buttons', 0 FROM p
ON CONFLICT (product_id, attribute_name) DO NOTHING;

WITH p AS (SELECT id FROM public.products_all WHERE status = 'active' LIMIT 1)
INSERT INTO public.product_variant_options (product_id, attribute_name, options, display_type, sort_order)
SELECT p.id, 'Color', '["Black","White","Navy"]'::jsonb, 'buttons', 1 FROM p
ON CONFLICT (product_id, attribute_name) DO NOTHING;

UPDATE public.products_all
SET has_variants = true, variant_types = ARRAY['Size','Color']
WHERE id = (SELECT id FROM public.products_all WHERE status = 'active' LIMIT 1);
