
-- Drop existing functions to recreate with updated logic
DROP FUNCTION IF EXISTS finalize_invoice(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS void_invoice(uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS repair_invoice_units(uuid, text, text) CASCADE;

-- Phase 2C.4: Recreate RPCs as flag-aware functions
CREATE FUNCTION finalize_invoice(
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
  v_line_item record;
  v_result json;
BEGIN
  SELECT COALESCE(use_canonical_units, false) INTO v_use_canonical FROM system_settings LIMIT 1;

  FOR v_line_item IN
    SELECT id, invoice_id, product_id, computed_tubes_total, computed_units_total, track_by
    FROM invoice_line_items
    WHERE invoice_id = p_invoice_id
  LOOP
    v_units := CASE
      WHEN v_use_canonical THEN COALESCE(v_line_item.computed_units_total, v_line_item.computed_tubes_total)
      ELSE COALESCE(v_line_item.computed_tubes_total, v_line_item.computed_units_total)
    END;

    IF v_line_item.track_by = 'tubes' THEN
      INSERT INTO tube_sale_ledger (product_id, quantity, direction, source_id, source_type)
      VALUES (v_line_item.product_id, v_units, 'out', v_line_item.id, 'invoice_finalization');
    ELSIF v_line_item.track_by = 'bags' THEN
      INSERT INTO bag_sale_ledger (product_id, quantity, direction, source_id, source_type)
      VALUES (v_line_item.product_id, v_units, 'out', v_line_item.id, 'invoice_finalization');
    END IF;
  END LOOP;

  UPDATE invoices SET status = 'finalized', updated_at = now() WHERE id = p_invoice_id;

  RETURN json_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'flag_used', v_use_canonical,
    'message', 'Invoice finalized successfully'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE FUNCTION void_invoice(
  p_invoice_id uuid,
  p_void_reason text DEFAULT NULL,
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
  v_line_item record;
  v_result json;
BEGIN
  SELECT COALESCE(use_canonical_units, false) INTO v_use_canonical FROM system_settings LIMIT 1;

  FOR v_line_item IN
    SELECT id, invoice_id, product_id, computed_tubes_total, computed_units_total, track_by
    FROM invoice_line_items
    WHERE invoice_id = p_invoice_id
  LOOP
    v_units := CASE
      WHEN v_use_canonical THEN COALESCE(v_line_item.computed_units_total, v_line_item.computed_tubes_total)
      ELSE COALESCE(v_line_item.computed_tubes_total, v_line_item.computed_units_total)
    END;

    IF v_line_item.track_by = 'tubes' THEN
      INSERT INTO tube_sale_ledger (product_id, quantity, direction, source_id, source_type, notes)
      VALUES (v_line_item.product_id, v_units, 'in', v_line_item.id, 'invoice_void', 'Void: ' || COALESCE(p_void_reason, 'N/A'));
    ELSIF v_line_item.track_by = 'bags' THEN
      INSERT INTO bag_sale_ledger (product_id, quantity, direction, source_id, source_type, notes)
      VALUES (v_line_item.product_id, v_units, 'in', v_line_item.id, 'invoice_void', 'Void: ' || COALESCE(p_void_reason, 'N/A'));
    END IF;
  END LOOP;

  UPDATE invoices SET status = 'voided', updated_at = now(), notes = COALESCE(p_void_reason, '') WHERE id = p_invoice_id;

  RETURN json_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'flag_used', v_use_canonical,
    'message', 'Invoice voided successfully'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE FUNCTION repair_invoice_units(
  p_invoice_id uuid,
  p_reason text,
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
  v_line_item record;
  v_result json;
BEGIN
  SELECT COALESCE(use_canonical_units, false) INTO v_use_canonical FROM system_settings LIMIT 1;

  FOR v_line_item IN
    SELECT id, invoice_id, product_id, computed_tubes_total, computed_units_total, track_by
    FROM invoice_line_items
    WHERE invoice_id = p_invoice_id
  LOOP
    v_units := CASE
      WHEN v_use_canonical THEN COALESCE(v_line_item.computed_units_total, v_line_item.computed_tubes_total)
      ELSE COALESCE(v_line_item.computed_tubes_total, v_line_item.computed_units_total)
    END;

    INSERT INTO inventory_repair_ledger (product_id, quantity, direction, reason, source_id, source_type, notes)
    VALUES (
      v_line_item.product_id,
      v_units,
      'correction',
      p_reason,
      v_line_item.id,
      'invoice_repair',
      'Repair: ' || p_reason
    );
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'flag_used', v_use_canonical,
    'message', 'Repair recorded successfully'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
