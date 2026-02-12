
-- =============================================
-- INVOICE PIPELINE HARDENING
-- =============================================

-- 1) IMMUTABILITY: Block updates/deletes on finalized invoices
CREATE OR REPLACE FUNCTION public.guard_finalized_invoice()
RETURNS TRIGGER AS $$
BEGIN
  -- For invoice table: check if current status is finalized
  IF TG_TABLE_NAME = 'invoices' THEN
    IF OLD.status = 'finalized' THEN
      -- Allow only specific safe fields to be updated (void flow, payment tracking, receipts)
      IF NEW.status IS DISTINCT FROM OLD.status 
         OR NEW.voided_at IS DISTINCT FROM OLD.voided_at
         OR NEW.void_reason IS DISTINCT FROM OLD.void_reason
         OR NEW.voided_by IS DISTINCT FROM OLD.voided_by
         OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
         OR NEW.amount_paid IS DISTINCT FROM OLD.amount_paid
         OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
         OR NEW.partial_amount IS DISTINCT FROM OLD.partial_amount
         OR NEW.receipt_sent_at IS DISTINCT FROM OLD.receipt_sent_at
         OR NEW.receipt_status IS DISTINCT FROM OLD.receipt_status
         OR NEW.receipt_message_sid IS DISTINCT FROM OLD.receipt_message_sid
         OR NEW.receipt_delivered_at IS DISTINCT FROM OLD.receipt_delivered_at
         OR NEW.receipt_failure_reason IS DISTINCT FROM OLD.receipt_failure_reason
         OR NEW.receipt_phone_used IS DISTINCT FROM OLD.receipt_phone_used
         OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
         OR NEW.deleted_by IS DISTINCT FROM OLD.deleted_by
         OR NEW.delete_reason IS DISTINCT FROM OLD.delete_reason
         OR NEW.repair_status IS DISTINCT FROM OLD.repair_status
         OR NEW.repair_notes IS DISTINCT FROM OLD.repair_notes
         OR NEW.repaired_at IS DISTINCT FROM OLD.repaired_at
         OR NEW.repaired_by IS DISTINCT FROM OLD.repaired_by
      THEN
        RETURN NEW; -- These fields are allowed on finalized invoices
      END IF;
      RAISE EXCEPTION 'Cannot modify a finalized invoice. Void it first to make corrections.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_guard_finalized_invoice
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_finalized_invoice();

-- 2) IMMUTABILITY: Block line item changes on finalized invoices
CREATE OR REPLACE FUNCTION public.guard_finalized_invoice_lines()
RETURNS TRIGGER AS $$
DECLARE
  v_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT status INTO v_status FROM invoices WHERE id = OLD.invoice_id;
    IF v_status = 'finalized' THEN
      RAISE EXCEPTION 'Cannot delete line items from a finalized invoice.';
    END IF;
    RETURN OLD;
  ELSE
    SELECT status INTO v_status FROM invoices WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    IF v_status = 'finalized' THEN
      RAISE EXCEPTION 'Cannot modify line items on a finalized invoice.';
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_guard_finalized_invoice_lines
  BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_finalized_invoice_lines();

-- 3) FINALIZE IDEMPOTENCY: Replace RAISE EXCEPTION with graceful return
CREATE OR REPLACE FUNCTION public.finalize_invoice(p_invoice_id uuid, p_user_id text DEFAULT 'manual')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_use_canonical boolean;
  v_units numeric;
  v_line record;
  v_cost_layer record;
  v_remaining int;
  v_consume int;
  v_store_id uuid;
  v_current_status text;
BEGIN
  -- Idempotency check: return success if already finalized
  SELECT status INTO v_current_status FROM invoices WHERE id = p_invoice_id;
  
  IF v_current_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invoice not found');
  END IF;
  
  IF v_current_status = 'finalized' THEN
    RETURN json_build_object('success', true, 'already_finalized', true, 'invoice_id', p_invoice_id, 'message', 'Invoice was already finalized. No duplicate entries created.');
  END IF;
  
  IF v_current_status = 'voided' THEN
    RETURN json_build_object('success', false, 'error', 'Cannot finalize a voided invoice');
  END IF;

  SELECT COALESCE(use_canonical_units, false) INTO v_use_canonical FROM system_settings LIMIT 1;

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

    IF v_line.track_by = 'tubes' THEN
      INSERT INTO tube_sale_ledger (invoice_id, line_item_id, store_id, brand_id, brand, product_id, product_name, tubes_delta, source, recorded_by)
      VALUES (v_line.invoice_id, v_line.id, v_store_id, v_line.brand_id, v_line.brand, v_line.product_id, v_line.product_name, -ABS(v_units), 'finalized', p_user_id)
      ON CONFLICT DO NOTHING;
    ELSIF v_line.track_by = 'bags' THEN
      INSERT INTO bag_sale_ledger (invoice_id, line_item_id, store_id, brand_id, product_id, product_name, bags_delta, source, recorded_by)
      VALUES (v_line.invoice_id, v_line.id, v_store_id, v_line.brand_id, v_line.product_id, v_line.product_name, -ABS(v_units)::int, 'finalized', p_user_id)
      ON CONFLICT DO NOTHING;
    END IF;

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

  -- Recompute totals from line items before finalizing
  UPDATE invoices SET
    subtotal = COALESCE((SELECT SUM(line_subtotal) FROM invoice_line_items WHERE invoice_id = p_invoice_id), 0),
    total = COALESCE((SELECT SUM(line_subtotal) FROM invoice_line_items WHERE invoice_id = p_invoice_id), 0),
    total_amount = COALESCE((SELECT SUM(line_subtotal) FROM invoice_line_items WHERE invoice_id = p_invoice_id), 0),
    status = 'finalized',
    finalized_at = now(),
    finalized_by = p_user_id
  WHERE id = p_invoice_id;

  RETURN json_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'flag_used', v_use_canonical,
    'message', 'Invoice finalized with COGS allocation'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- 4) TOTALS VIEW: Compute invoice totals from line items
CREATE OR REPLACE VIEW public.v_invoice_totals AS
SELECT
  i.id AS invoice_id,
  i.store_id,
  i.invoice_number,
  i.status,
  COALESCE(SUM(li.line_subtotal), 0) AS computed_subtotal,
  COALESCE(i.tax, 0) AS tax_total,
  COALESCE(SUM(li.line_subtotal), 0) + COALESCE(i.tax, 0) AS computed_total,
  COALESCE(SUM(li.computed_units_total), 0) AS units_total,
  COALESCE(SUM(li.computed_tubes_total), 0) AS tubes_total,
  COUNT(li.id) AS line_count,
  i.total AS header_total,
  i.subtotal AS header_subtotal,
  ABS(COALESCE(SUM(li.line_subtotal), 0) - COALESCE(i.total, 0)) AS total_drift
FROM invoices i
LEFT JOIN invoice_line_items li ON li.invoice_id = i.id
GROUP BY i.id, i.store_id, i.invoice_number, i.status, i.tax, i.total, i.subtotal;

-- 5) Fix the due_date trigger to use created_at date properly  
CREATE OR REPLACE FUNCTION public.set_invoice_due_date_default()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.due_date IS NULL THEN
    NEW.due_date := (COALESCE(NEW.created_at, now())::date + 30);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
