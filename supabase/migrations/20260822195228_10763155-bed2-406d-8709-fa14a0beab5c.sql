-- 1. Marker column: invoice is finalized, was reopened for correction, not yet re-finalized
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS reopened_for_edit boolean NOT NULL DEFAULT false;

-- 2. Status-consistency guard must not flip a reopened invoice back to finalized
CREATE OR REPLACE FUNCTION public.validate_invoice_status_consistency()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.payment_status IN ('paid', 'partial', 'refunded') AND NEW.status = 'draft'
     AND NOT COALESCE(NEW.reopened_for_edit, false) THEN
    NEW.status := 'finalized';
    NEW.finalized_at := COALESCE(NEW.finalized_at, now());
    NEW.finalized_by := COALESCE(NEW.finalized_by, 'auto_status_sync');
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Finalized-invoice guard: allow the reopen marker itself to change
CREATE OR REPLACE FUNCTION public.guard_finalized_invoice()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_merge_flag       text;
  v_store_id_changed boolean;
BEGIN
  IF TG_TABLE_NAME <> 'invoices' THEN
    RETURN NEW;
  END IF;

  IF OLD.status <> 'finalized' THEN
    RETURN NEW;
  END IF;

  v_store_id_changed := NEW.store_id IS DISTINCT FROM OLD.store_id;

  IF v_store_id_changed THEN
    v_merge_flag := current_setting('app.merge_in_progress', true);

    IF v_merge_flag IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION
        'Finalized invoice store_id can only change inside the merge engine (app.merge_in_progress flag required).';
    END IF;

    IF to_jsonb(NEW) - 'store_id' <> to_jsonb(OLD) - 'store_id' THEN
      RAISE EXCEPTION
        'Merge bypass permits store_id changes only; other columns may not be modified in the same UPDATE.';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.status              IS DISTINCT FROM OLD.status
     OR NEW.voided_at        IS DISTINCT FROM OLD.voided_at
     OR NEW.void_reason      IS DISTINCT FROM OLD.void_reason
     OR NEW.voided_by        IS DISTINCT FROM OLD.voided_by
     OR NEW.payment_status   IS DISTINCT FROM OLD.payment_status
     OR NEW.amount_paid      IS DISTINCT FROM OLD.amount_paid
     OR NEW.paid_at          IS DISTINCT FROM OLD.paid_at
     OR NEW.partial_amount   IS DISTINCT FROM OLD.partial_amount
     OR NEW.receipt_sent_at  IS DISTINCT FROM OLD.receipt_sent_at
     OR NEW.receipt_status   IS DISTINCT FROM OLD.receipt_status
     OR NEW.receipt_message_sid    IS DISTINCT FROM OLD.receipt_message_sid
     OR NEW.receipt_delivered_at   IS DISTINCT FROM OLD.receipt_delivered_at
     OR NEW.receipt_failure_reason IS DISTINCT FROM OLD.receipt_failure_reason
     OR NEW.receipt_phone_used     IS DISTINCT FROM OLD.receipt_phone_used
     OR NEW.deleted_at       IS DISTINCT FROM OLD.deleted_at
     OR NEW.deleted_by       IS DISTINCT FROM OLD.deleted_by
     OR NEW.delete_reason    IS DISTINCT FROM OLD.delete_reason
     OR NEW.repair_status    IS DISTINCT FROM OLD.repair_status
     OR NEW.repair_notes     IS DISTINCT FROM OLD.repair_notes
     OR NEW.repaired_at      IS DISTINCT FROM OLD.repaired_at
     OR NEW.repaired_by      IS DISTINCT FROM OLD.repaired_by
     OR NEW.entry_mode       IS DISTINCT FROM OLD.entry_mode
     OR NEW.revenue_role     IS DISTINCT FROM OLD.revenue_role
     OR NEW.sale_never_imported IS DISTINCT FROM OLD.sale_never_imported
     OR NEW.referenced_external_number IS DISTINCT FROM OLD.referenced_external_number
     OR NEW.reopened_for_edit IS DISTINCT FROM OLD.reopened_for_edit
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Cannot modify a finalized invoice. Void it first to make corrections.';
END;
$function$;

-- 4. reopen_invoice: set the marker so the consistency guard leaves the draft alone
CREATE OR REPLACE FUNCTION public.reopen_invoice(p_invoice_id uuid, p_reason text, p_user_id text DEFAULT 'admin'::text)
 RETURNS json
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_inv invoices%ROWTYPE; v_lines jsonb;
BEGIN
  SELECT * INTO v_inv FROM invoices WHERE id = p_invoice_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice % not found', p_invoice_id; END IF;

  IF v_inv.status <> 'finalized' THEN
    RETURN json_build_object('success', true, 'note', 'Invoice was not finalized — edit it directly.',
                             'status', v_inv.status);
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'A reason is required to reopen a finalized invoice.';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(li)), '[]'::jsonb) INTO v_lines
  FROM invoice_line_items li WHERE li.invoice_id = p_invoice_id;

  INSERT INTO invoice_amendment_log (invoice_id, action, reason, before_snapshot, lines_snapshot, actor)
  VALUES (p_invoice_id, 'reopen', p_reason, to_jsonb(v_inv), v_lines, p_user_id);

  UPDATE invoices SET status = 'draft', reopened_for_edit = true WHERE id = p_invoice_id;

  RETURN json_build_object('success', true, 'invoice_id', p_invoice_id,
    'note', 'Invoice reopened as draft. Edit the lines, then call finalize_invoice() again.',
    'snapshot_saved', true);
END $function$;

-- 5. finalize_invoice: clear the marker when re-locking
CREATE OR REPLACE FUNCTION public.finalize_invoice(p_invoice_id uuid, p_user_id text DEFAULT 'manual'::text)
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

  IF v_current_status = 'draft_ai' THEN
    RETURN json_build_object('success', false, 'error', 'AI-drafted invoice requires human review and approval before finalization');
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
      VALUES (v_line.invoice_id, v_line.id, v_store_id, v_line.brand_id, v_line.brand, v_line.product_id, v_line.product_name, -ABS(v_units), 'invoice_finalized', p_user_id)
      ON CONFLICT DO NOTHING;
    ELSIF v_line.track_by = 'bags' THEN
      INSERT INTO bag_sale_ledger (invoice_id, line_item_id, store_id, brand_id, product_id, product_name, bags_delta, source, recorded_by)
      VALUES (v_line.invoice_id, v_line.id, v_store_id, v_line.brand_id, v_line.product_id, v_line.product_name, -ABS(v_units)::int, 'invoice_finalized', p_user_id)
      ON CONFLICT DO NOTHING;
    END IF;
    v_remaining := ABS(v_units)::int;
    FOR v_cost_layer IN
      SELECT id, unit_cost, units_in, units_consumed FROM inventory_cost_ledger
      WHERE product_id = v_line.product_id AND units_consumed < units_in
      ORDER BY received_at ASC, created_at ASC
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_consume := LEAST(v_remaining, v_cost_layer.units_in - v_cost_layer.units_consumed);
      INSERT INTO cogs_ledger (invoice_id, line_item_id, product_id, product_name, cost_layer_id, units_consumed, unit_cost, total_cost, source, recorded_by)
      VALUES (v_line.invoice_id, v_line.id, v_line.product_id, v_line.product_name, v_cost_layer.id, v_consume, v_cost_layer.unit_cost, v_consume * v_cost_layer.unit_cost, 'invoice_finalized', p_user_id)
      ON CONFLICT (invoice_id, line_item_id, product_id, cost_layer_id) DO NOTHING;
      UPDATE inventory_cost_ledger SET units_consumed = units_consumed + v_consume WHERE id = v_cost_layer.id;
      v_remaining := v_remaining - v_consume;
    END LOOP;
  END LOOP;

  UPDATE invoices SET
    subtotal = COALESCE((SELECT SUM(line_subtotal) FROM invoice_line_items WHERE invoice_id = p_invoice_id), 0),
    total = COALESCE((SELECT SUM(line_subtotal) FROM invoice_line_items WHERE invoice_id = p_invoice_id), 0),
    total_amount = COALESCE((SELECT SUM(line_subtotal) FROM invoice_line_items WHERE invoice_id = p_invoice_id), 0),
    status = 'finalized', finalized_at = now(), finalized_by = p_user_id,
    reopened_for_edit = false
  WHERE id = p_invoice_id;

  RETURN json_build_object('success', true, 'invoice_id', p_invoice_id, 'flag_used', v_use_canonical, 'message', 'Invoice finalized with COGS allocation');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;