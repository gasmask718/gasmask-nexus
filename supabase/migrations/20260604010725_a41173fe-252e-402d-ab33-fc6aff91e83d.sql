
-- 1. ADDRESSES
CREATE TABLE public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text,
  address jsonb NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT ALL ON public.addresses TO service_role;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addresses_own_select" ON public.addresses FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "addresses_own_insert" ON public.addresses FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "addresses_own_update" ON public.addresses FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "addresses_own_delete" ON public.addresses FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX idx_addresses_user ON public.addresses(user_id);

-- 2. REVIEWS
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  user_id uuid NOT NULL,
  order_id uuid,
  verified_purchase boolean NOT NULL DEFAULT false,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text text,
  status text NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_read_approved" ON public.reviews FOR SELECT TO anon, authenticated USING (status = 'approved' OR user_id = auth.uid());
CREATE POLICY "reviews_own_insert" ON public.reviews FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "reviews_own_update" ON public.reviews FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "reviews_own_delete" ON public.reviews FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX idx_reviews_product ON public.reviews(product_id) WHERE status = 'approved';
CREATE INDEX idx_reviews_user ON public.reviews(user_id);

-- 3. DISCOUNTS
CREATE TABLE public.discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  type text NOT NULL CHECK (type IN ('percent','fixed')),
  value numeric NOT NULL CHECK (value >= 0),
  expires_at timestamptz,
  usage_limit int,
  used_count int NOT NULL DEFAULT 0,
  first_order_only boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.discounts TO anon, authenticated;
GRANT ALL ON public.discounts TO service_role;
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
-- No public table policies for write; only validate via RPC. Read is allowed for client-side preview optionally; tighten if needed.
CREATE POLICY "discounts_read_active" ON public.discounts FOR SELECT TO anon, authenticated USING (active = true);

-- validate_discount RPC
CREATE OR REPLACE FUNCTION public.validate_discount(
  p_code text,
  p_user_id uuid DEFAULT NULL,
  p_guest_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.discounts%ROWTYPE;
  prior_orders int := 0;
BEGIN
  SELECT * INTO d FROM public.discounts WHERE code = upper(p_code) OR code = p_code LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'code_not_found');
  END IF;
  IF d.active = false THEN
    RETURN jsonb_build_object('valid', false, 'error', 'code_inactive');
  END IF;
  IF d.expires_at IS NOT NULL AND d.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'expired');
  END IF;
  IF d.usage_limit IS NOT NULL AND d.used_count >= d.usage_limit THEN
    RETURN jsonb_build_object('valid', false, 'error', 'usage_limit_reached');
  END IF;
  IF d.first_order_only THEN
    IF p_user_id IS NOT NULL THEN
      SELECT count(*) INTO prior_orders FROM public.marketplace_orders
        WHERE customer_id = p_user_id AND payment_status = 'paid';
    ELSIF p_guest_email IS NOT NULL THEN
      SELECT count(*) INTO prior_orders FROM public.marketplace_orders
        WHERE customer_email = p_guest_email AND payment_status = 'paid';
    END IF;
    IF prior_orders > 0 THEN
      RETURN jsonb_build_object('valid', false, 'error', 'not_first_order');
    END IF;
  END IF;
  RETURN jsonb_build_object(
    'valid', true,
    'discount_id', d.id,
    'code', d.code,
    'type', d.type,
    'value', d.value,
    'first_order_only', d.first_order_only
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_discount(text, uuid, text) TO anon, authenticated, service_role;

-- Atomic increment helper
CREATE OR REPLACE FUNCTION public.increment_discount_usage(p_code text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.discounts SET used_count = used_count + 1, updated_at = now()
  WHERE code = p_code;
$$;

GRANT EXECUTE ON FUNCTION public.increment_discount_usage(text) TO service_role;

-- 4. Extend dd_create_marketplace_order to accept discount code
-- We add a new overload with p_discount_code so existing callers still work.
CREATE OR REPLACE FUNCTION public.dd_create_marketplace_order(
  p_items jsonb,
  p_shipping_address jsonb,
  p_guest_email text DEFAULT NULL,
  p_guest_phone text DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL,
  p_subtotal numeric DEFAULT 0,
  p_shipping_cost numeric DEFAULT 0,
  p_tax_amount numeric DEFAULT 0,
  p_notes text DEFAULT NULL,
  p_discount_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_total numeric;
  v_item jsonb;
  v_discount jsonb;
  v_discount_amount numeric := 0;
BEGIN
  -- Validate + apply discount
  IF p_discount_code IS NOT NULL AND length(trim(p_discount_code)) > 0 THEN
    v_discount := public.validate_discount(p_discount_code, p_customer_id, p_guest_email);
    IF (v_discount->>'valid')::boolean IS NOT TRUE THEN
      RETURN jsonb_build_object('success', false, 'error', 'discount_invalid', 'detail', v_discount->>'error');
    END IF;
    IF v_discount->>'type' = 'percent' THEN
      v_discount_amount := round((p_subtotal * (v_discount->>'value')::numeric / 100)::numeric, 2);
    ELSE
      v_discount_amount := least(p_subtotal, (v_discount->>'value')::numeric);
    END IF;
  END IF;

  v_total := greatest(0, p_subtotal - v_discount_amount) + coalesce(p_shipping_cost,0) + coalesce(p_tax_amount,0);

  INSERT INTO public.marketplace_orders (
    customer_id, customer_email, customer_phone,
    shipping_address, subtotal, shipping_cost, tax_amount, total_amount,
    payment_status, fulfillment_status, notes, discount_code, discount_amount
  ) VALUES (
    p_customer_id, p_guest_email, p_guest_phone,
    p_shipping_address, p_subtotal, coalesce(p_shipping_cost,0), coalesce(p_tax_amount,0), v_total,
    'pending', 'pending', p_notes, p_discount_code, v_discount_amount
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.marketplace_order_items (order_id, product_id, qty, price_each)
    VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      coalesce((v_item->>'qty')::int, (v_item->>'quantity')::int, 1),
      coalesce((v_item->>'price_each')::numeric, (v_item->>'price')::numeric, 0)
    );
  END LOOP;

  -- Route + reserve (best effort)
  BEGIN
    PERFORM public.route_order_to_supplier(v_order_id);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Increment discount usage
  IF p_discount_code IS NOT NULL AND v_discount_amount > 0 THEN
    PERFORM public.increment_discount_usage(p_discount_code);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'total', v_total,
    'discount_amount', v_discount_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dd_create_marketplace_order(jsonb,jsonb,text,text,uuid,numeric,numeric,numeric,text,text) TO anon, authenticated, service_role;

-- Add discount columns to marketplace_orders if missing
ALTER TABLE public.marketplace_orders
  ADD COLUMN IF NOT EXISTS discount_code text,
  ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;

-- Seed two test discounts
INSERT INTO public.discounts (code, type, value, expires_at, usage_limit, first_order_only)
VALUES
  ('TEST-10PCT', 'percent', 10, now() + interval '90 days', 1000, false),
  ('TEST-FIRST5', 'fixed', 5, now() + interval '90 days', 500, true)
ON CONFLICT (code) DO NOTHING;
