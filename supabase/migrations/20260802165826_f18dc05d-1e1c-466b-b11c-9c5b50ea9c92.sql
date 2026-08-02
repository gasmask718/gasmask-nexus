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

    -- Fulfillment records only for wholesaler-fulfilled lines
    FOR v_vendor IN
      SELECT DISTINCT oi.wholesaler_id
      FROM marketplace_order_items oi
      WHERE oi.order_id = p_order_id AND oi.wholesaler_id IS NOT NULL
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM marketplace_fulfillments f
        WHERE f.order_id = p_order_id AND f.wholesaler_id = v_vendor.wholesaler_id
      ) THEN
        SELECT jsonb_agg(jsonb_build_object(
          'product_id', oi.product_id, 'product_name', p.product_name,
          'qty', oi.qty, 'price_each', oi.price_each,
          'subtotal', oi.price_each * COALESCE(oi.qty,1)))
        INTO v_item_snapshot
        FROM marketplace_order_items oi
        LEFT JOIN products_all p ON p.id = oi.product_id
        WHERE oi.order_id = p_order_id AND oi.wholesaler_id = v_vendor.wholesaler_id;

        INSERT INTO marketplace_fulfillments (order_id, wholesaler_id, status, items_snapshot)
        VALUES (p_order_id, v_vendor.wholesaler_id, 'pending', v_item_snapshot);
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