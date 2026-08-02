-- ============ 1. Order-level fields ============
ALTER TABLE public.marketplace_orders
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipping_paid_by text;

UPDATE public.marketplace_orders
SET paid_at = COALESCE(paid_at, updated_at, created_at)
WHERE payment_status = 'paid' AND paid_at IS NULL;

UPDATE public.marketplace_orders
SET shipping_paid_by = CASE WHEN COALESCE(shipping_funded_by_customer, true) THEN 'customer' ELSE 'dynasty' END
WHERE shipping_paid_by IS NULL;

ALTER TABLE public.marketplace_orders
  ALTER COLUMN shipping_paid_by SET DEFAULT 'customer';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_orders_shipping_paid_by_chk') THEN
    ALTER TABLE public.marketplace_orders
      ADD CONSTRAINT marketplace_orders_shipping_paid_by_chk
      CHECK (shipping_paid_by IS NULL OR shipping_paid_by IN ('customer','dynasty','supplier'));
  END IF;
END $$;

-- ============ 2. Economics ledger ============
ALTER TABLE public.marketplace_commissions
  ALTER COLUMN wholesaler_id DROP NOT NULL,
  ALTER COLUMN commission_rate DROP NOT NULL;

ALTER TABLE public.marketplace_commissions
  ADD COLUMN IF NOT EXISTS order_item_id uuid,
  ADD COLUMN IF NOT EXISTS supplier_id uuid,
  ADD COLUMN IF NOT EXISTS product_id uuid,
  ADD COLUMN IF NOT EXISTS quantity integer,
  ADD COLUMN IF NOT EXISTS unit_supplier_cost_cents integer,
  ADD COLUMN IF NOT EXISTS cost_snapshot_at timestamptz,
  ADD COLUMN IF NOT EXISTS cost_source text,
  ADD COLUMN IF NOT EXISTS sale_amount_cents integer,
  ADD COLUMN IF NOT EXISTS supplier_payable_cents integer,
  ADD COLUMN IF NOT EXISTS shipping_attributed_cents integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_paid_by text,
  ADD COLUMN IF NOT EXISTS processor_fee_share_cents integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dynasty_gross_cents integer,
  ADD COLUMN IF NOT EXISTS dynasty_net_cents integer,
  ADD COLUMN IF NOT EXISTS payout_status text NOT NULL DEFAULT 'held',
  ADD COLUMN IF NOT EXISTS rate_source text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_commissions_payout_status_chk') THEN
    ALTER TABLE public.marketplace_commissions
      ADD CONSTRAINT marketplace_commissions_payout_status_chk
      CHECK (payout_status IN ('held','approved','paid','reversed','void'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_commissions_order_item_uidx
  ON public.marketplace_commissions(order_item_id) WHERE order_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketplace_commissions_order_idx
  ON public.marketplace_commissions(order_id);
CREATE INDEX IF NOT EXISTS marketplace_commissions_supplier_idx
  ON public.marketplace_commissions(supplier_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_commissions TO authenticated;
GRANT ALL ON public.marketplace_commissions TO service_role;

COMMENT ON TABLE public.marketplace_commissions IS
  'Per-order-line economics ledger. Dynasty sets price, buys at supplier cost; supplier_payable is a fixed dollar amount (snapshotted cost x qty), dynasty_gross = sale (+/- shipping) - supplier_payable, dynasty_net = gross - processor_fee_share. Rate-based commissions are RETIRED. payout_status starts at held; suppliers are only paid after fulfillment.';

-- ============ 3. Cost-at-time helper ============
CREATE OR REPLACE FUNCTION public.dd_supplier_cost_cents_at(p_product_id uuid, p_at timestamptz)
RETURNS TABLE(cost_cents integer, cost_source text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_c integer;
BEGIN
  SELECT h.new_cost_cents INTO v_c
  FROM supplier_cost_history h
  WHERE h.product_id = p_product_id AND h.created_at <= COALESCE(p_at, now())
  ORDER BY h.created_at DESC, h.id DESC
  LIMIT 1;

  IF v_c IS NOT NULL THEN
    RETURN QUERY SELECT v_c, 'cost_history'::text; RETURN;
  END IF;

  SELECT COALESCE(NULLIF(p.supplier_cost_cents,0), ROUND(COALESCE(p.supplier_cost,0)*100)::int)
  INTO v_c FROM products_all p WHERE p.id = p_product_id;

  RETURN QUERY SELECT COALESCE(v_c,0), CASE WHEN COALESCE(v_c,0) > 0 THEN 'current_cost' ELSE 'unknown' END;
END;
$$;

-- ============ 4. Core economics writer (idempotent) ============
CREATE OR REPLACE FUNCTION public.dd_write_order_economics(p_order_id uuid, p_rate_source text DEFAULT 'live')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_paid_at timestamptz;
  v_ship_by text;
  v_ship_cents integer;
  v_total_cents integer;
  v_sale_total_cents integer := 0;
  v_processor_total_cents integer;
  v_alloc_ship integer;
  v_alloc_fee integer;
  v_used_ship integer := 0;
  v_used_fee integer := 0;
  v_rows integer := 0;
  v_n integer;
  v_i integer := 0;
  v_cost integer;
  v_cost_src text;
  v_sale integer;
  v_payable integer;
  v_gross integer;
  v_net integer;
  v_supplier uuid;
BEGIN
  SELECT * INTO v_order FROM marketplace_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order % not found', p_order_id; END IF;
  IF v_order.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'Order % is not paid (status: %)', p_order_id, v_order.payment_status;
  END IF;

  v_paid_at := COALESCE(v_order.paid_at, v_order.updated_at, v_order.created_at);
  v_ship_by := COALESCE(v_order.shipping_paid_by, CASE WHEN COALESCE(v_order.shipping_funded_by_customer,true) THEN 'customer' ELSE 'dynasty' END);
  v_ship_cents := ROUND(COALESCE(v_order.shipping_cost,0)*100)::int;
  v_total_cents := ROUND(COALESCE(v_order.total,0)*100)::int;

  SELECT COALESCE(SUM(ROUND(COALESCE(oi.price_each,0)*100)::int * COALESCE(oi.qty,1)),0), COUNT(*)
    INTO v_sale_total_cents, v_n
  FROM marketplace_order_items oi WHERE oi.order_id = p_order_id;

  IF v_n = 0 THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'lines', 0, 'note', 'no line items');
  END IF;

  -- Processor cost: Stripe-style 2.9% + $0.30 on the charged total
  v_processor_total_cents := CASE WHEN v_total_cents > 0
    THEN ROUND(v_total_cents * 0.029)::int + 30 ELSE 0 END;

  FOR v_item IN
    SELECT oi.id, oi.product_id, oi.wholesaler_id, COALESCE(oi.qty,1) AS qty,
           COALESCE(oi.price_each,0) AS price_each, p.supplier_id
    FROM marketplace_order_items oi
    LEFT JOIN products_all p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
    ORDER BY oi.created_at, oi.id
  LOOP
    v_i := v_i + 1;
    v_sale := ROUND(v_item.price_each*100)::int * v_item.qty;

    SELECT c.cost_cents, c.cost_source INTO v_cost, v_cost_src
    FROM dd_supplier_cost_cents_at(v_item.product_id, v_paid_at) c;

    v_payable := COALESCE(v_cost,0) * v_item.qty;
    v_supplier := COALESCE(v_item.supplier_id, v_item.wholesaler_id);

    -- pro-rata allocation (last line absorbs rounding remainder)
    IF v_i = v_n THEN
      v_alloc_ship := v_ship_cents - v_used_ship;
      v_alloc_fee  := v_processor_total_cents - v_used_fee;
    ELSIF v_sale_total_cents > 0 THEN
      v_alloc_ship := ROUND(v_ship_cents::numeric * v_sale / v_sale_total_cents)::int;
      v_alloc_fee  := ROUND(v_processor_total_cents::numeric * v_sale / v_sale_total_cents)::int;
    ELSE
      v_alloc_ship := 0; v_alloc_fee := 0;
    END IF;
    v_used_ship := v_used_ship + v_alloc_ship;
    v_used_fee  := v_used_fee + v_alloc_fee;

    -- Shipping attribution
    --   customer : customer funded it -> shipping revenue stays with Dynasty gross
    --   dynasty  : Dynasty eats the carrier cost -> subtract from gross
    --   supplier : supplier ships and is reimbursed -> added to supplier payable
    IF v_ship_by = 'supplier' THEN
      v_payable := v_payable + v_alloc_ship;
      v_gross := v_sale + v_alloc_ship - v_payable;
    ELSIF v_ship_by = 'dynasty' THEN
      v_gross := v_sale - v_payable - v_alloc_ship;
    ELSE
      v_gross := v_sale + v_alloc_ship - v_payable;
    END IF;

    v_net := v_gross - v_alloc_fee;

    INSERT INTO marketplace_commissions (
      order_id, order_item_id, supplier_id, wholesaler_id, product_id, quantity,
      unit_supplier_cost_cents, cost_snapshot_at, cost_source,
      sale_amount_cents, supplier_payable_cents, shipping_attributed_cents, shipping_paid_by,
      processor_fee_share_cents, dynasty_gross_cents, dynasty_net_cents,
      payout_status, rate_source,
      gross_amount, commission_rate, commission_amount, wholesaler_net, updated_at
    ) VALUES (
      p_order_id, v_item.id, v_supplier, v_item.wholesaler_id, v_item.product_id, v_item.qty,
      COALESCE(v_cost,0), v_paid_at, v_cost_src,
      v_sale, v_payable, v_alloc_ship, v_ship_by,
      v_alloc_fee, v_gross, v_net,
      'held', COALESCE(p_rate_source,'live'),
      v_sale/100.0, 0, v_gross/100.0, v_payable/100.0, now()
    )
    ON CONFLICT (order_item_id) DO UPDATE SET
      order_id = EXCLUDED.order_id,
      supplier_id = EXCLUDED.supplier_id,
      wholesaler_id = EXCLUDED.wholesaler_id,
      product_id = EXCLUDED.product_id,
      quantity = EXCLUDED.quantity,
      unit_supplier_cost_cents = EXCLUDED.unit_supplier_cost_cents,
      cost_snapshot_at = EXCLUDED.cost_snapshot_at,
      cost_source = EXCLUDED.cost_source,
      sale_amount_cents = EXCLUDED.sale_amount_cents,
      supplier_payable_cents = EXCLUDED.supplier_payable_cents,
      shipping_attributed_cents = EXCLUDED.shipping_attributed_cents,
      shipping_paid_by = EXCLUDED.shipping_paid_by,
      processor_fee_share_cents = EXCLUDED.processor_fee_share_cents,
      dynasty_gross_cents = EXCLUDED.dynasty_gross_cents,
      dynasty_net_cents = EXCLUDED.dynasty_net_cents,
      gross_amount = EXCLUDED.gross_amount,
      commission_amount = EXCLUDED.commission_amount,
      wholesaler_net = EXCLUDED.wholesaler_net,
      rate_source = EXCLUDED.rate_source,
      updated_at = now()
    WHERE marketplace_commissions.payout_status = 'held';

    v_rows := v_rows + 1;
  END LOOP;

  RETURN (
    SELECT jsonb_build_object(
      'order_id', p_order_id,
      'paid_at', v_paid_at,
      'shipping_paid_by', v_ship_by,
      'lines', v_rows,
      'processor_fee_cents', v_processor_total_cents,
      'dynasty_gross_cents', COALESCE(SUM(mc.dynasty_gross_cents),0),
      'dynasty_net_cents', COALESCE(SUM(mc.dynasty_net_cents),0),
      'supplier_payables', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('supplier_id', s.supplier_id, 'payable_cents', s.p, 'payout_status','held'))
        FROM (SELECT supplier_id, SUM(supplier_payable_cents) p
              FROM marketplace_commissions WHERE order_id = p_order_id GROUP BY supplier_id) s
      ), '[]'::jsonb)
    )
    FROM marketplace_commissions mc WHERE mc.order_id = p_order_id
  );
END;
$$;

-- ============ 5. process_paid_order rewrite ============
CREATE OR REPLACE FUNCTION public.process_paid_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_items RECORD;
  v_vendor RECORD;
  v_first_pass boolean;
  v_econ jsonb;
  v_item_snapshot jsonb;
BEGIN
  SELECT * INTO v_order FROM marketplace_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order % not found', p_order_id; END IF;
  IF v_order.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'Order % is not paid (status: %)', p_order_id, v_order.payment_status;
  END IF;

  IF v_order.paid_at IS NULL THEN
    UPDATE marketplace_orders SET paid_at = COALESCE(updated_at, created_at) WHERE id = p_order_id;
    SELECT * INTO v_order FROM marketplace_orders WHERE id = p_order_id;
  END IF;

  v_first_pass := COALESCE(v_order.fulfillment_status,'pending') IN ('pending','draft');

  IF v_first_pass THEN
    FOR v_items IN
      SELECT oi.product_id, oi.qty, p.product_name, p.inventory_qty
      FROM marketplace_order_items oi
      JOIN products_all p ON p.id = oi.product_id
      WHERE oi.order_id = p_order_id
    LOOP
      IF v_items.inventory_qty IS NOT NULL AND v_items.inventory_qty < COALESCE(v_items.qty,0) THEN
        RAISE EXCEPTION 'Insufficient inventory for product % (available: %, requested: %)',
          v_items.product_name, v_items.inventory_qty, v_items.qty;
      END IF;
    END LOOP;

    UPDATE products_all p
    SET inventory_qty = p.inventory_qty - oi.qty
    FROM marketplace_order_items oi
    WHERE oi.order_id = p_order_id AND p.id = oi.product_id AND p.inventory_qty IS NOT NULL;

    FOR v_vendor IN
      SELECT DISTINCT COALESCE(oi.wholesaler_id, p.supplier_id) AS supplier_id
      FROM marketplace_order_items oi
      LEFT JOIN products_all p ON p.id = oi.product_id
      WHERE oi.order_id = p_order_id AND COALESCE(oi.wholesaler_id, p.supplier_id) IS NOT NULL
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM marketplace_fulfillments f
        WHERE f.order_id = p_order_id AND f.wholesaler_id = v_vendor.supplier_id
      ) THEN
        SELECT jsonb_agg(jsonb_build_object(
          'product_id', oi.product_id, 'product_name', p.product_name,
          'qty', oi.qty, 'price_each', oi.price_each,
          'subtotal', oi.price_each * COALESCE(oi.qty,1)))
        INTO v_item_snapshot
        FROM marketplace_order_items oi
        LEFT JOIN products_all p ON p.id = oi.product_id
        WHERE oi.order_id = p_order_id
          AND COALESCE(oi.wholesaler_id, p.supplier_id) = v_vendor.supplier_id;

        INSERT INTO marketplace_fulfillments (order_id, wholesaler_id, status, items_snapshot)
        VALUES (p_order_id, v_vendor.supplier_id, 'pending', v_item_snapshot);
      END IF;
    END LOOP;

    UPDATE marketplace_orders
    SET fulfillment_status = 'awaiting_fulfillment', updated_at = now()
    WHERE id = p_order_id;
  END IF;

  v_econ := dd_write_order_economics(p_order_id, 'live');

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'first_pass', v_first_pass,
    'status', CASE WHEN v_first_pass THEN 'awaiting_fulfillment' ELSE COALESCE(v_order.fulfillment_status,'unchanged') END,
    'economics', v_econ
  );
END;
$$;

-- ============ 6. Backfill ============
CREATE OR REPLACE FUNCTION public.dd_backfill_order_economics()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r RECORD; v_orders int := 0; v_lines int := 0; v_res jsonb;
BEGIN
  FOR r IN SELECT id FROM marketplace_orders WHERE payment_status = 'paid' ORDER BY created_at LOOP
    UPDATE marketplace_orders SET paid_at = COALESCE(paid_at, updated_at, created_at) WHERE id = r.id;
    v_res := dd_write_order_economics(r.id, 'backfill');
    v_orders := v_orders + 1;
    v_lines := v_lines + COALESCE((v_res->>'lines')::int, 0);
  END LOOP;
  RETURN jsonb_build_object('orders_processed', v_orders, 'lines_written', v_lines);
END;
$$;

REVOKE ALL ON FUNCTION public.dd_write_order_economics(uuid, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.dd_backfill_order_economics() FROM anon, authenticated;