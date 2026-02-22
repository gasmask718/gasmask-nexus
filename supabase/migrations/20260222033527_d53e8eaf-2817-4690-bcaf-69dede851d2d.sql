
-- =============================================
-- PHASE 1: MULTI-VENDOR ORDER ENGINE CORE
-- Evolving existing tables into clearinghouse
-- =============================================

-- 1. Add commission_percent and warehouse_address to wholesaler_profiles
ALTER TABLE public.wholesaler_profiles
  ADD COLUMN IF NOT EXISTS commission_percent numeric DEFAULT 15.0,
  ADD COLUMN IF NOT EXISTS warehouse_address text;

-- 2. Add order_id to wholesaler_payouts for per-order tracking
ALTER TABLE public.wholesaler_payouts
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.marketplace_orders(id);

CREATE INDEX IF NOT EXISTS idx_wholesaler_payouts_order_id ON public.wholesaler_payouts(order_id);

-- 3. Create marketplace_fulfillments table (per-vendor per-order)
CREATE TABLE IF NOT EXISTS public.marketplace_fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.marketplace_orders(id),
  wholesaler_id uuid NOT NULL REFERENCES public.wholesaler_profiles(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'label_generated', 'shipped', 'completed')),
  shipping_label_url text,
  tracking_number text,
  carrier text,
  items_snapshot jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_mf_order_id ON public.marketplace_fulfillments(order_id);
CREATE INDEX idx_mf_wholesaler_id ON public.marketplace_fulfillments(wholesaler_id);
CREATE UNIQUE INDEX idx_mf_order_vendor ON public.marketplace_fulfillments(order_id, wholesaler_id);

-- 4. RLS on marketplace_fulfillments
ALTER TABLE public.marketplace_fulfillments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors see own fulfillments"
  ON public.marketplace_fulfillments FOR SELECT
  TO authenticated
  USING (
    wholesaler_id IN (
      SELECT id FROM public.wholesaler_profiles WHERE user_id = auth.uid()
    )
    OR public.is_elevated_admin(auth.uid())
  );

CREATE POLICY "Vendors update own fulfillments"
  ON public.marketplace_fulfillments FOR UPDATE
  TO authenticated
  USING (
    wholesaler_id IN (
      SELECT id FROM public.wholesaler_profiles WHERE user_id = auth.uid()
    )
    OR public.is_elevated_admin(auth.uid())
  );

CREATE POLICY "Admins insert fulfillments"
  ON public.marketplace_fulfillments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_elevated_admin(auth.uid()));

CREATE POLICY "System can insert fulfillments"
  ON public.marketplace_fulfillments FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 5. process_paid_order() — Atomic order splitting engine
CREATE OR REPLACE FUNCTION public.process_paid_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_vendor RECORD;
  v_items RECORD;
  v_gross numeric;
  v_commission numeric;
  v_payout numeric;
  v_commission_pct numeric;
  v_result jsonb := '[]'::jsonb;
  v_fulfillment_id uuid;
  v_item_snapshot jsonb;
BEGIN
  -- Lock the order row
  SELECT * INTO v_order
  FROM marketplace_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  IF v_order.payment_status != 'paid' THEN
    RAISE EXCEPTION 'Order % is not paid (status: %)', p_order_id, v_order.payment_status;
  END IF;

  IF v_order.fulfillment_status NOT IN ('pending', 'draft', NULL) THEN
    RAISE EXCEPTION 'Order % already processed (status: %)', p_order_id, v_order.fulfillment_status;
  END IF;

  -- Check inventory for ALL items first (fail fast)
  FOR v_items IN
    SELECT oi.product_id, oi.qty, oi.price_each, oi.wholesaler_id,
           p.product_name, p.inventory_qty
    FROM marketplace_order_items oi
    JOIN products_all p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
  LOOP
    IF v_items.inventory_qty IS NOT NULL AND v_items.inventory_qty < COALESCE(v_items.qty, 0) THEN
      RAISE EXCEPTION 'Insufficient inventory for product % (available: %, requested: %)',
        v_items.product_name, v_items.inventory_qty, v_items.qty;
    END IF;
  END LOOP;

  -- Decrement inventory
  UPDATE products_all p
  SET inventory_qty = p.inventory_qty - oi.qty
  FROM marketplace_order_items oi
  WHERE oi.order_id = p_order_id
    AND p.id = oi.product_id
    AND p.inventory_qty IS NOT NULL;

  -- Group by vendor and process
  FOR v_vendor IN
    SELECT DISTINCT oi.wholesaler_id
    FROM marketplace_order_items oi
    WHERE oi.order_id = p_order_id
      AND oi.wholesaler_id IS NOT NULL
  LOOP
    -- Calculate gross for this vendor
    SELECT COALESCE(SUM(oi.price_each * COALESCE(oi.qty, 1)), 0)
    INTO v_gross
    FROM marketplace_order_items oi
    WHERE oi.order_id = p_order_id
      AND oi.wholesaler_id = v_vendor.wholesaler_id;

    -- Get vendor commission rate
    SELECT COALESCE(wp.commission_percent, 15.0)
    INTO v_commission_pct
    FROM wholesaler_profiles wp
    WHERE wp.id = v_vendor.wholesaler_id;

    v_commission := ROUND(v_gross * (v_commission_pct / 100.0), 2);
    v_payout := v_gross - v_commission;

    -- Build items snapshot for this vendor
    SELECT jsonb_agg(jsonb_build_object(
      'product_id', oi.product_id,
      'product_name', p.product_name,
      'qty', oi.qty,
      'price_each', oi.price_each,
      'subtotal', oi.price_each * COALESCE(oi.qty, 1)
    ))
    INTO v_item_snapshot
    FROM marketplace_order_items oi
    JOIN products_all p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
      AND oi.wholesaler_id = v_vendor.wholesaler_id;

    -- Create fulfillment record
    INSERT INTO marketplace_fulfillments (order_id, wholesaler_id, status, items_snapshot)
    VALUES (p_order_id, v_vendor.wholesaler_id, 'pending', v_item_snapshot)
    RETURNING id INTO v_fulfillment_id;

    -- Create payout ledger entry
    INSERT INTO wholesaler_payouts (wholesaler_id, order_id, amount, platform_fee, net_amount, status)
    VALUES (v_vendor.wholesaler_id, p_order_id, v_gross, v_commission, v_payout, 'pending');

    -- Accumulate result
    v_result := v_result || jsonb_build_object(
      'wholesaler_id', v_vendor.wholesaler_id,
      'fulfillment_id', v_fulfillment_id,
      'gross', v_gross,
      'commission', v_commission,
      'payout', v_payout,
      'items_count', jsonb_array_length(v_item_snapshot)
    );
  END LOOP;

  -- Update order status
  UPDATE marketplace_orders
  SET fulfillment_status = 'awaiting_fulfillment',
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'status', 'awaiting_fulfillment',
    'vendor_splits', v_result
  );
END;
$$;

-- 6. Trigger: auto-process when payment_status changes to 'paid'
CREATE OR REPLACE FUNCTION public.trigger_process_paid_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'paid'
     AND (OLD.payment_status IS DISTINCT FROM 'paid')
     AND (NEW.fulfillment_status IS NULL OR NEW.fulfillment_status IN ('pending', 'draft'))
  THEN
    PERFORM process_paid_order(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_process_paid_order ON public.marketplace_orders;
CREATE TRIGGER trg_auto_process_paid_order
  AFTER UPDATE OF payment_status ON public.marketplace_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_process_paid_order();
