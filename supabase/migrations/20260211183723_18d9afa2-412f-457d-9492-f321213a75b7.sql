
-- ====================================================================
-- PHASE 1B: TUBE-NATIVE INVOICES + PRODUCT PRICING + DISCOUNTS
-- ====================================================================

-- A) PRODUCTS TABLE — Add track_by, sale_unit_default, price_per_box, price_per_unit
-- ====================================================================

-- track_by: 'tubes' (default, ledger-tracked), 'units' (generic), 'none' (no tracking)
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS track_by text NOT NULL DEFAULT 'tubes',
  ADD COLUMN IF NOT EXISTS sale_unit_default text NOT NULL DEFAULT 'box',
  ADD COLUMN IF NOT EXISTS price_per_box numeric(10,2),
  ADD COLUMN IF NOT EXISTS price_per_unit numeric(10,2) NOT NULL DEFAULT 0;

-- Backfill price_per_unit from existing price_per_tube where available
UPDATE public.products 
SET price_per_unit = COALESCE(price_per_tube, 0)
WHERE price_per_tube IS NOT NULL AND price_per_unit = 0;

-- Backfill price_per_box from suggested_retail_price where available (box = default retail price)
UPDATE public.products 
SET price_per_box = suggested_retail_price
WHERE price_per_box IS NULL AND suggested_retail_price IS NOT NULL;

-- Validation: if track_by='tubes' then units_per_box must be > 0
CREATE OR REPLACE FUNCTION public.validate_product_tracking()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.track_by = 'tubes' AND (NEW.units_per_box IS NULL OR NEW.units_per_box <= 0) THEN
    RAISE EXCEPTION 'Products tracked by tubes must have units_per_box > 0';
  END IF;
  IF NEW.price_per_unit < 0 THEN
    RAISE EXCEPTION 'price_per_unit must be >= 0';
  END IF;
  IF NEW.price_per_box IS NOT NULL AND NEW.price_per_box < 0 THEN
    RAISE EXCEPTION 'price_per_box must be >= 0 when set';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_product_tracking ON public.products;
CREATE TRIGGER trg_validate_product_tracking
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_product_tracking();


-- B) INVOICES — Add status for draft/finalized/voided
-- ====================================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS finalized_by text,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by text,
  ADD COLUMN IF NOT EXISTS void_reason text;

-- Backfill existing invoices as 'finalized' (they already have ledger entries)
UPDATE public.invoices SET status = 'finalized' WHERE status = 'draft';


-- C) INVOICE_LINE_ITEMS — Add discount/override pricing columns
-- ====================================================================

ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS product_name_snapshot text,
  ADD COLUMN IF NOT EXISTS brand_name_snapshot text,
  ADD COLUMN IF NOT EXISTS list_unit_price numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_price_used numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS discount_value numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason text,
  ADD COLUMN IF NOT EXISTS price_override_reason text,
  ADD COLUMN IF NOT EXISTS line_subtotal numeric(10,2) NOT NULL DEFAULT 0;

-- Backfill snapshots from existing data
UPDATE public.invoice_line_items 
SET 
  product_name_snapshot = COALESCE(product_name_snapshot, product_name),
  brand_name_snapshot = COALESCE(brand_name_snapshot, brand),
  list_unit_price = COALESCE(NULLIF(list_unit_price, 0), unit_price, 0),
  unit_price_used = COALESCE(NULLIF(unit_price_used, 0), unit_price, 0),
  line_subtotal = COALESCE(NULLIF(line_subtotal, 0), total, 0);


-- D) TUBE_SALE_LEDGER — Unique constraint + immutability + product_id
-- ====================================================================

ALTER TABLE public.tube_sale_ledger
  ADD COLUMN IF NOT EXISTS product_id uuid;

-- Unique constraint to prevent double-posting
CREATE UNIQUE INDEX IF NOT EXISTS idx_tube_sale_ledger_unique_posting 
  ON public.tube_sale_ledger (invoice_id, line_item_id, source);

-- Immutability trigger — prevent UPDATE/DELETE on tube_sale_ledger
CREATE OR REPLACE FUNCTION public.protect_tube_sale_ledger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'tube_sale_ledger is immutable: % operations are not allowed', TG_OP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_tube_sale_ledger_update ON public.tube_sale_ledger;
CREATE TRIGGER trg_protect_tube_sale_ledger_update
  BEFORE UPDATE ON public.tube_sale_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_tube_sale_ledger();

DROP TRIGGER IF EXISTS trg_protect_tube_sale_ledger_delete ON public.tube_sale_ledger;
CREATE TRIGGER trg_protect_tube_sale_ledger_delete
  BEFORE DELETE ON public.tube_sale_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_tube_sale_ledger();


-- E) UPDATED TRIGGERS — compute units + line subtotals server-side
-- ====================================================================

CREATE OR REPLACE FUNCTION public.compute_line_item_tubes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Enforce mutual exclusivity based on sale_unit
  IF NEW.sale_unit = 'box' THEN
    NEW.quantity_tubes := NULL;
    IF NEW.quantity_boxes IS NULL OR NEW.quantity_boxes <= 0 THEN
      NEW.quantity_boxes := NEW.quantity;
    END IF;
  ELSIF NEW.sale_unit = 'unit' THEN
    NEW.quantity_boxes := NULL;
    IF NEW.quantity_tubes IS NULL OR NEW.quantity_tubes <= 0 THEN
      NEW.quantity_tubes := NEW.quantity;
    END IF;
  END IF;

  -- Compute total units
  NEW.computed_tubes_total := 
    COALESCE(NEW.quantity_boxes, 0) * COALESCE(NEW.units_per_box_snapshot, 1)
    + COALESCE(NEW.quantity_tubes, 0);

  -- Compute line_subtotal server-side
  IF NEW.unit_price_used > 0 THEN
    IF NEW.sale_unit = 'box' THEN
      NEW.line_subtotal := NEW.unit_price_used * COALESCE(NEW.quantity_boxes, 0);
    ELSE
      NEW.line_subtotal := NEW.unit_price_used * COALESCE(NEW.quantity_tubes, 0);
    END IF;
  ELSE
    -- Fallback to legacy total
    NEW.line_subtotal := COALESCE(NEW.total, 0);
  END IF;

  -- Enforce non-negative
  IF NEW.unit_price_used < 0 THEN
    NEW.unit_price_used := 0;
  END IF;

  -- Populate snapshots if empty
  IF NEW.product_name_snapshot IS NULL THEN
    NEW.product_name_snapshot := NEW.product_name;
  END IF;
  IF NEW.brand_name_snapshot IS NULL THEN
    NEW.brand_name_snapshot := NEW.brand;
  END IF;

  RETURN NEW;
END;
$$;


-- F) FINALIZE INVOICE RPC
-- ====================================================================

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
  v_product RECORD;
BEGIN
  -- Lock and verify invoice
  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
  END IF;
  
  IF v_invoice.status != 'draft' THEN
    RAISE EXCEPTION 'Invoice must be in draft status to finalize. Current status: %', v_invoice.status;
  END IF;

  -- Recompute totals from line items
  FOR v_line IN 
    SELECT * FROM public.invoice_line_items WHERE invoice_id = p_invoice_id
  LOOP
    v_total := v_total + COALESCE(v_line.line_subtotal, v_line.total, 0);
    v_total_tubes := v_total_tubes + COALESCE(v_line.computed_tubes_total, 0);
    v_total_boxes := v_total_boxes + COALESCE(v_line.quantity_boxes, 0);

    -- Check if product is tube-tracked, then write ledger
    SELECT track_by INTO v_product FROM public.products WHERE id = v_line.product_id;
    
    IF v_product.track_by = 'tubes' OR v_product IS NULL THEN
      -- Default to tube tracking for backward compatibility
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

  -- Update invoice
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


-- G) VOID INVOICE RPC
-- ====================================================================

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
  v_product RECORD;
BEGIN
  -- Lock and verify invoice
  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
  END IF;
  
  IF v_invoice.status != 'finalized' THEN
    RAISE EXCEPTION 'Only finalized invoices can be voided. Current status: %', v_invoice.status;
  END IF;

  IF p_void_reason IS NULL OR trim(p_void_reason) = '' THEN
    RAISE EXCEPTION 'A void reason is required';
  END IF;

  -- Write reversal entries for tube-tracked products
  FOR v_line IN 
    SELECT * FROM public.invoice_line_items WHERE invoice_id = p_invoice_id
  LOOP
    SELECT track_by INTO v_product FROM public.products WHERE id = v_line.product_id;
    
    IF v_product.track_by = 'tubes' OR v_product IS NULL THEN
      INSERT INTO public.tube_sale_ledger (
        invoice_id, line_item_id, store_id, brand_id, product_id,
        brand, product_name, tubes_delta, source, recorded_by
      ) VALUES (
        p_invoice_id, v_line.id, v_invoice.store_id, v_line.brand_id, v_line.product_id,
        COALESCE(v_line.brand_name_snapshot, v_line.brand),
        COALESCE(v_line.product_name_snapshot, v_line.product_name),
        +v_line.computed_tubes_total,  -- positive = reversal
        'invoice_voided_reversal',
        COALESCE(p_user_id, 'system')
      ) ON CONFLICT (invoice_id, line_item_id, source) DO NOTHING;
      
      v_reversed_tubes := v_reversed_tubes + v_line.computed_tubes_total;
    END IF;
  END LOOP;

  -- Update invoice
  UPDATE public.invoices SET
    status = 'voided',
    voided_at = now(),
    voided_by = COALESCE(p_user_id, 'system'),
    void_reason = p_void_reason
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'reversed_tubes', v_reversed_tubes,
    'status', 'voided'
  );
END;
$$;


-- H) REPORTING VIEWS
-- ====================================================================

CREATE OR REPLACE VIEW public.v_tubes_sold_per_store_per_day AS
SELECT 
  store_id,
  brand_id,
  brand,
  date_trunc('day', created_at) as sale_date,
  SUM(CASE WHEN source = 'invoice_finalized' THEN ABS(tubes_delta) ELSE 0 END) as tubes_sold,
  SUM(CASE WHEN source = 'invoice_voided_reversal' THEN tubes_delta ELSE 0 END) as tubes_reversed,
  SUM(tubes_delta) as net_tubes_delta
FROM public.tube_sale_ledger
GROUP BY store_id, brand_id, brand, date_trunc('day', created_at);

CREATE OR REPLACE VIEW public.v_tubes_sold_per_invoice AS
SELECT 
  invoice_id,
  SUM(CASE WHEN source = 'invoice_finalized' THEN ABS(tubes_delta) ELSE 0 END) as tubes_sold,
  SUM(CASE WHEN source = 'invoice_voided_reversal' THEN tubes_delta ELSE 0 END) as tubes_reversed,
  SUM(tubes_delta) as net_tubes_delta,
  COUNT(DISTINCT line_item_id) as line_items_count
FROM public.tube_sale_ledger
GROUP BY invoice_id;
