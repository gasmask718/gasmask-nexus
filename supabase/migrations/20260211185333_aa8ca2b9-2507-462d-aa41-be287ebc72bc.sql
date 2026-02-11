
-- ====================================================================
-- PHASE 1B TIGHTENING: Critical Final Adjustments
-- ====================================================================

-- 1) Enforce track_by NOT NULL DEFAULT 'none' on products
ALTER TABLE public.products 
  ALTER COLUMN track_by SET DEFAULT 'none';

UPDATE public.products SET track_by = 'none' WHERE track_by IS NULL;

ALTER TABLE public.products 
  ALTER COLUMN track_by SET NOT NULL;

-- 2) Fix finalize_invoice: remove dangerous NULL = tubes fallback
CREATE OR REPLACE FUNCTION public.finalize_invoice(p_invoice_id uuid, p_user_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invoice RECORD;
  v_line RECORD;
  v_total numeric := 0;
  v_total_tubes numeric := 0;
  v_total_boxes numeric := 0;
  v_track_by text;
BEGIN
  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
  END IF;
  
  IF v_invoice.status != 'draft' THEN
    RAISE EXCEPTION 'Invoice must be in draft status to finalize. Current status: %', v_invoice.status;
  END IF;

  FOR v_line IN 
    SELECT * FROM public.invoice_line_items WHERE invoice_id = p_invoice_id
  LOOP
    v_total := v_total + COALESCE(v_line.line_subtotal, v_line.total, 0);
    v_total_tubes := v_total_tubes + COALESCE(v_line.computed_tubes_total, 0);
    v_total_boxes := v_total_boxes + COALESCE(v_line.quantity_boxes, 0);

    -- Only write ledger for tube-tracked products (explicit check, no NULL fallback)
    SELECT COALESCE(track_by, 'none') INTO v_track_by FROM public.products WHERE id = v_line.product_id;
    
    IF v_track_by = 'tubes' THEN
      INSERT INTO public.tube_sale_ledger (
        invoice_id, line_item_id, store_id, brand_id, product_id,
        brand, product_name, tubes_delta, source, recorded_by
      ) VALUES (
        p_invoice_id, v_line.id, v_invoice.store_id, v_line.brand_id, v_line.product_id,
        COALESCE(v_line.brand_name_snapshot, v_line.brand),
        COALESCE(v_line.product_name_snapshot, v_line.product_name),
        -v_line.computed_tubes_total,
        'invoice_finalized',
        COALESCE(p_user_id, 'system')
      ) ON CONFLICT (invoice_id, line_item_id, source) DO NOTHING;
    END IF;
  END LOOP;

  UPDATE public.invoices SET
    status = 'finalized',
    subtotal = v_total,
    total = v_total,
    total_amount = v_total,
    total_tubes_sold = v_total_tubes,
    total_boxes_sold = v_total_boxes,
    finalized_at = now(),
    finalized_by = COALESCE(p_user_id, 'system')
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'total', v_total,
    'total_tubes', v_total_tubes,
    'status', 'finalized'
  );
END;
$$;

-- 3) Fix void_invoice: same explicit track_by check
CREATE OR REPLACE FUNCTION public.void_invoice(p_invoice_id uuid, p_void_reason text, p_user_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invoice RECORD;
  v_line RECORD;
  v_reversed_tubes numeric := 0;
  v_track_by text;
BEGIN
  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
  END IF;
  
  IF v_invoice.status != 'finalized' THEN
    RAISE EXCEPTION 'Only finalized invoices can be voided. Current status: %', v_invoice.status;
  END IF;

  FOR v_line IN 
    SELECT * FROM public.invoice_line_items WHERE invoice_id = p_invoice_id
  LOOP
    SELECT COALESCE(track_by, 'none') INTO v_track_by FROM public.products WHERE id = v_line.product_id;
    
    IF v_track_by = 'tubes' THEN
      INSERT INTO public.tube_sale_ledger (
        invoice_id, line_item_id, store_id, brand_id, product_id,
        brand, product_name, tubes_delta, source, recorded_by
      ) VALUES (
        p_invoice_id, v_line.id, v_invoice.store_id, v_line.brand_id, v_line.product_id,
        COALESCE(v_line.brand_name_snapshot, v_line.brand),
        COALESCE(v_line.product_name_snapshot, v_line.product_name),
        v_line.computed_tubes_total,
        'invoice_voided_reversal',
        COALESCE(p_user_id, 'system')
      ) ON CONFLICT (invoice_id, line_item_id, source) DO NOTHING;
      
      v_reversed_tubes := v_reversed_tubes + COALESCE(v_line.computed_tubes_total, 0);
    END IF;
  END LOOP;

  UPDATE public.invoices SET
    status = 'voided',
    void_reason = p_void_reason,
    voided_at = now(),
    voided_by = COALESCE(p_user_id, 'system')
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'reversed_tubes', v_reversed_tubes,
    'status', 'voided'
  );
END;
$$;

-- 4) Discount/override reason enforcement trigger
CREATE OR REPLACE FUNCTION public.validate_price_override_reason()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.unit_price_used IS DISTINCT FROM NEW.list_unit_price
     AND NEW.list_unit_price > 0
     AND COALESCE(NEW.discount_reason, '') = ''
     AND COALESCE(NEW.price_override_reason, '') = ''
  THEN
    RAISE EXCEPTION 'Discount or price override requires a reason (discount_reason or price_override_reason must be set)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_price_override_reason ON public.invoice_line_items;
CREATE TRIGGER trg_validate_price_override_reason
  BEFORE INSERT OR UPDATE ON public.invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_price_override_reason();

-- 5) Rename trigger compute_line_item_tubes → compute_line_item_units (function stays, trigger name updates)
DROP TRIGGER IF EXISTS trg_compute_line_item_tubes ON public.invoice_line_items;
DROP TRIGGER IF EXISTS compute_line_item_tubes ON public.invoice_line_items;
DROP TRIGGER IF EXISTS trg_compute_line_item_units ON public.invoice_line_items;

CREATE TRIGGER trg_compute_line_item_units
  BEFORE INSERT OR UPDATE ON public.invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_line_item_tubes();
