
-- ============================================================
-- PHASE 1C: BAGS AS FIRST-CLASS TRACKING TYPE
-- ============================================================

-- 1) Ensure track_by supports 'bags' (text column, no enum change needed)
-- The column is already text, so 'bags' is valid. We just add constraints.

-- 2) Update the product validation trigger to handle 'bags'
CREATE OR REPLACE FUNCTION public.validate_product_tracking()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Tube-tracked products MUST have units_per_box > 0
  IF NEW.track_by = 'tubes' AND (NEW.units_per_box IS NULL OR NEW.units_per_box <= 0) THEN
    RAISE EXCEPTION 'Tube-tracked products must have units_per_box > 0';
  END IF;

  -- Bag-tracked products must NOT have units_per_box set
  IF NEW.track_by = 'bags' AND NEW.units_per_box IS NOT NULL AND NEW.units_per_box > 0 THEN
    RAISE EXCEPTION 'Bag-tracked products must NOT have units_per_box';
  END IF;

  -- Price validation
  IF NEW.price_per_unit IS NOT NULL AND NEW.price_per_unit < 0 THEN
    RAISE EXCEPTION 'price_per_unit must be >= 0';
  END IF;

  IF NEW.price_per_box IS NOT NULL AND NEW.price_per_box < 0 THEN
    RAISE EXCEPTION 'price_per_box must be >= 0';
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Create bag_sale_ledger (parallel to tube_sale_ledger)
CREATE TABLE IF NOT EXISTS public.bag_sale_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id),
  line_item_id uuid NOT NULL REFERENCES public.invoice_line_items(id),
  store_id uuid NOT NULL REFERENCES public.store_master(id),
  brand_id uuid REFERENCES public.brands(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  product_name text,
  bags_delta integer NOT NULL, -- negative = sold, positive = reversed
  source text NOT NULL, -- 'invoice_finalized' | 'invoice_voided_reversal'
  recorded_by text,
  created_at timestamptz DEFAULT now()
);

-- Unique constraint to prevent double-posting
CREATE UNIQUE INDEX IF NOT EXISTS idx_bag_sale_ledger_unique
ON public.bag_sale_ledger (invoice_id, line_item_id, source);

-- Enable RLS
ALTER TABLE public.bag_sale_ledger ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as tube_sale_ledger)
CREATE POLICY "Authenticated users can view bag ledger"
ON public.bag_sale_ledger FOR SELECT
TO authenticated
USING (true);

-- Immutability trigger: prevent UPDATE/DELETE
CREATE OR REPLACE FUNCTION public.prevent_bag_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'bag_sale_ledger is immutable. UPDATE and DELETE are not allowed.';
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_bag_ledger_no_update
BEFORE UPDATE ON public.bag_sale_ledger
FOR EACH ROW
EXECUTE FUNCTION public.prevent_bag_ledger_mutation();

CREATE TRIGGER trg_bag_ledger_no_delete
BEFORE DELETE ON public.bag_sale_ledger
FOR EACH ROW
EXECUTE FUNCTION public.prevent_bag_ledger_mutation();

-- 4) Update finalize_invoice RPC to branch on tubes vs bags
CREATE OR REPLACE FUNCTION public.finalize_invoice(p_invoice_id uuid, p_user_id text DEFAULT 'system')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice record;
  v_line record;
  v_product record;
  v_total_amount numeric := 0;
  v_total_tubes integer := 0;
  v_total_bags integer := 0;
  v_line_count integer := 0;
BEGIN
  -- Lock and verify invoice
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id FOR UPDATE;
  
  IF v_invoice IS NULL THEN
    RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
  END IF;
  
  IF v_invoice.status != 'draft' THEN
    RAISE EXCEPTION 'Invoice must be in draft status to finalize. Current status: %', v_invoice.status;
  END IF;

  -- Process each line item
  FOR v_line IN
    SELECT * FROM invoice_line_items WHERE invoice_id = p_invoice_id
  LOOP
    v_line_count := v_line_count + 1;
    v_total_amount := v_total_amount + COALESCE(v_line.line_subtotal, v_line.total, 0);

    -- Look up the product to determine tracking type
    SELECT * INTO v_product FROM products WHERE id = v_line.product_id;

    -- TUBES: Write to tube_sale_ledger
    IF v_product IS NOT NULL AND v_product.track_by = 'tubes' THEN
      v_total_tubes := v_total_tubes + COALESCE(v_line.computed_tubes_total, 0);

      INSERT INTO tube_sale_ledger (
        invoice_id, line_item_id, store_id, brand_id, product_id,
        product_name, tubes_delta, source, recorded_by
      ) VALUES (
        p_invoice_id, v_line.id, v_invoice.store_id, v_line.brand_id, v_line.product_id,
        COALESCE(v_line.product_name_snapshot, v_line.product_name),
        -COALESCE(v_line.computed_tubes_total, 0),
        'invoice_finalized',
        p_user_id
      );
    END IF;

    -- BAGS: Write to bag_sale_ledger
    IF v_product IS NOT NULL AND v_product.track_by = 'bags' THEN
      v_total_bags := v_total_bags + COALESCE(v_line.computed_tubes_total, 0);

      INSERT INTO bag_sale_ledger (
        invoice_id, line_item_id, store_id, brand_id, product_id,
        product_name, bags_delta, source, recorded_by
      ) VALUES (
        p_invoice_id, v_line.id, v_invoice.store_id, v_line.brand_id, v_line.product_id,
        COALESCE(v_line.product_name_snapshot, v_line.product_name),
        -COALESCE(v_line.computed_tubes_total, 0),
        'invoice_finalized',
        p_user_id
      );
    END IF;
  END LOOP;

  -- Update invoice status and totals
  UPDATE invoices SET
    status = 'finalized',
    total_amount = v_total_amount,
    total_tubes_sold = v_total_tubes,
    finalized_at = now(),
    finalized_by = p_user_id
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'status', 'finalized',
    'line_items', v_line_count,
    'total_amount', v_total_amount,
    'total_tubes', v_total_tubes,
    'total_bags', v_total_bags
  );
END;
$$;

-- 5) Update void_invoice RPC to reverse both tube and bag ledger entries
CREATE OR REPLACE FUNCTION public.void_invoice(p_invoice_id uuid, p_void_reason text, p_user_id text DEFAULT 'system')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice record;
  v_line record;
  v_product record;
  v_reversed_tubes integer := 0;
  v_reversed_bags integer := 0;
BEGIN
  -- Lock and verify invoice
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id FOR UPDATE;
  
  IF v_invoice IS NULL THEN
    RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
  END IF;
  
  IF v_invoice.status != 'finalized' THEN
    RAISE EXCEPTION 'Only finalized invoices can be voided. Current status: %', v_invoice.status;
  END IF;

  -- Process each line item for reversal
  FOR v_line IN
    SELECT * FROM invoice_line_items WHERE invoice_id = p_invoice_id
  LOOP
    SELECT * INTO v_product FROM products WHERE id = v_line.product_id;

    -- TUBES: Reverse in tube_sale_ledger
    IF v_product IS NOT NULL AND v_product.track_by = 'tubes' THEN
      v_reversed_tubes := v_reversed_tubes + COALESCE(v_line.computed_tubes_total, 0);

      INSERT INTO tube_sale_ledger (
        invoice_id, line_item_id, store_id, brand_id, product_id,
        product_name, tubes_delta, source, recorded_by
      ) VALUES (
        p_invoice_id, v_line.id, v_invoice.store_id, v_line.brand_id, v_line.product_id,
        COALESCE(v_line.product_name_snapshot, v_line.product_name),
        +COALESCE(v_line.computed_tubes_total, 0),
        'invoice_voided_reversal',
        p_user_id
      );
    END IF;

    -- BAGS: Reverse in bag_sale_ledger
    IF v_product IS NOT NULL AND v_product.track_by = 'bags' THEN
      v_reversed_bags := v_reversed_bags + COALESCE(v_line.computed_tubes_total, 0);

      INSERT INTO bag_sale_ledger (
        invoice_id, line_item_id, store_id, brand_id, product_id,
        product_name, bags_delta, source, recorded_by
      ) VALUES (
        p_invoice_id, v_line.id, v_invoice.store_id, v_line.brand_id, v_line.product_id,
        COALESCE(v_line.product_name_snapshot, v_line.product_name),
        +COALESCE(v_line.computed_tubes_total, 0),
        'invoice_voided_reversal',
        p_user_id
      );
    END IF;
  END LOOP;

  -- Update invoice status
  UPDATE invoices SET
    status = 'voided',
    void_reason = p_void_reason,
    voided_at = now(),
    voided_by = p_user_id
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'status', 'voided',
    'reversed_tubes', v_reversed_tubes,
    'reversed_bags', v_reversed_bags,
    'void_reason', p_void_reason
  );
END;
$$;

-- 6) Reporting views for bags
CREATE OR REPLACE VIEW public.v_bags_sold_per_store_per_day AS
SELECT
  store_id,
  product_id,
  product_name,
  brand_id,
  DATE(created_at) AS sale_date,
  SUM(bags_delta) AS net_bags
FROM public.bag_sale_ledger
WHERE source = 'invoice_finalized'
GROUP BY store_id, product_id, product_name, brand_id, DATE(created_at);

CREATE OR REPLACE VIEW public.v_bags_sold_per_brand_per_day AS
SELECT
  brand_id,
  DATE(created_at) AS sale_date,
  SUM(bags_delta) AS net_bags
FROM public.bag_sale_ledger
WHERE source = 'invoice_finalized'
GROUP BY brand_id, DATE(created_at);

CREATE OR REPLACE VIEW public.v_bags_sold_per_invoice AS
SELECT
  invoice_id,
  SUM(bags_delta) AS net_bags
FROM public.bag_sale_ledger
GROUP BY invoice_id;
