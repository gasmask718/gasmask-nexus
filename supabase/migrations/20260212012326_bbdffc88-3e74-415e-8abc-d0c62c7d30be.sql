-- Phase 5 Hardening: Finalize Lock
-- Prevent double-finalization of invoices

CREATE OR REPLACE FUNCTION public.finalize_invoice(
  p_invoice_id uuid,
  p_user_id text DEFAULT 'manual'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_use_canonical boolean;
  v_units numeric;
  v_line record;
  v_cost_layer record;
  v_remaining int;
  v_consume int;
  v_store_id uuid;
BEGIN
  -- Finalize lock: prevent double-finalization
  IF EXISTS (
    SELECT 1 FROM invoices
    WHERE id = p_invoice_id AND status = 'finalized'
  ) THEN
    RAISE EXCEPTION 'Invoice already finalized';
  END IF;

  SELECT COALESCE(use_canonical_units, false) INTO v_use_canonical FROM system_settings LIMIT 1;

  -- Get store_id from the invoice
  SELECT store_id INTO v_store_id FROM invoices WHERE id = p_invoice_id;

  FOR v_line IN
    SELECT li.id, li.invoice_id, li.product_id, li.product_name,
           li.brand_id, li.brand, li.line_subtotal,
           li.computed_tubes_total, li.computed_units_total,
           p.track_by
    FROM invoice_line_items li
    LEFT JOIN products p ON p.id = li.product_id
    WHERE li.invoice_id = p_invoice_id
  LOOP
    v_units := CASE
      WHEN v_use_canonical THEN COALESCE(v_line.computed_units_total, v_line.computed_tubes_total)
      ELSE COALESCE(v_line.computed_tubes_total, v_line.computed_units_total)
    END;

    -- Post to sale ledger
    IF v_line.track_by = 'tubes' THEN
      INSERT INTO tube_sale_ledger (invoice_id, line_item_id, store_id, brand_id, brand, product_id, product_name, tubes_delta, source, recorded_by)
      VALUES (v_line.invoice_id, v_line.id, v_store_id, v_line.brand_id, v_line.brand, v_line.product_id, v_line.product_name, -ABS(v_units), 'finalized', p_user_id)
      ON CONFLICT DO NOTHING;
    ELSIF v_line.track_by = 'bags' THEN
      INSERT INTO bag_sale_ledger (invoice_id, line_item_id, store_id, brand_id, product_id, product_name, bags_delta, source, recorded_by)
      VALUES (v_line.invoice_id, v_line.id, v_store_id, v_line.brand_id, v_line.product_id, v_line.product_name, -ABS(v_units)::int, 'finalized', p_user_id)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Phase 5C: FIFO cost allocation
    v_remaining := ABS(v_units)::int;

    FOR v_cost_layer IN
      SELECT id, unit_cost, units_in, units_consumed
      FROM inventory_cost_ledger
      WHERE product_id = v_line.product_id
        AND units_consumed < units_in
      ORDER BY received_at ASC, created_at ASC
    LOOP
      EXIT WHEN v_remaining <= 0;

      v_consume := LEAST(v_remaining, v_cost_layer.units_in - v_cost_layer.units_consumed);

      INSERT INTO cogs_ledger (
        invoice_id, line_item_id, product_id, product_name,
        cost_layer_id, units_consumed, unit_cost, total_cost,
        source, recorded_by
      ) VALUES (
        v_line.invoice_id, v_line.id, v_line.product_id, v_line.product_name,
        v_cost_layer.id, v_consume, v_cost_layer.unit_cost, v_consume * v_cost_layer.unit_cost,
        'invoice_finalized', p_user_id
      ) ON CONFLICT (invoice_id, line_item_id, product_id, cost_layer_id) DO NOTHING;

      UPDATE inventory_cost_ledger
      SET units_consumed = units_consumed + v_consume
      WHERE id = v_cost_layer.id;

      v_remaining := v_remaining - v_consume;
    END LOOP;
  END LOOP;

  UPDATE invoices SET status = 'finalized', updated_at = now() WHERE id = p_invoice_id;

  RETURN json_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'flag_used', v_use_canonical,
    'message', 'Invoice finalized with COGS allocation'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;