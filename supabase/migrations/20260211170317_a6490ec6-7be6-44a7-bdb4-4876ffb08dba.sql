
-- ============================================================
-- PHASE 1: TUBE-NATIVE INVOICE SYSTEM
-- Forward-only. No historical data modification.
-- ============================================================

-- 1. Add price_per_tube to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS price_per_tube numeric DEFAULT NULL;

-- 2. Add tube-aware columns to invoice_line_items
ALTER TABLE public.invoice_line_items
ADD COLUMN IF NOT EXISTS quantity_boxes numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS quantity_tubes numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS computed_tubes_total numeric NOT NULL DEFAULT 0;

-- 3. Add tube totals to invoices header
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS total_tubes_sold numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_boxes_sold numeric NOT NULL DEFAULT 0;

-- 4. Create immutable tube_sale_ledger for audit trail
CREATE TABLE IF NOT EXISTS public.tube_sale_ledger (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  line_item_id uuid NOT NULL REFERENCES public.invoice_line_items(id) ON DELETE RESTRICT,
  store_id uuid REFERENCES public.store_master(id),
  brand_id uuid,
  brand text,
  product_name text,
  tubes_delta numeric NOT NULL,
  source text NOT NULL DEFAULT 'invoice',
  recorded_by text
);

-- Enable RLS on tube_sale_ledger
ALTER TABLE public.tube_sale_ledger ENABLE ROW LEVEL SECURITY;

-- Ledger is immutable: authenticated users can read, only service role can insert
CREATE POLICY "Authenticated users can read tube_sale_ledger"
  ON public.tube_sale_ledger FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service and authenticated can insert tube_sale_ledger"
  ON public.tube_sale_ledger FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- No UPDATE or DELETE policies — ledger is append-only

-- 5. Trigger: auto-compute computed_tubes_total on line item insert/update
CREATE OR REPLACE FUNCTION public.compute_line_item_tubes()
RETURNS TRIGGER AS $$
BEGIN
  -- If quantity_boxes or quantity_tubes are set, compute from them
  IF NEW.quantity_boxes IS NOT NULL OR NEW.quantity_tubes IS NOT NULL THEN
    NEW.computed_tubes_total := COALESCE(
      (COALESCE(NEW.quantity_boxes, 0) * COALESCE(NEW.units_per_box_snapshot, 1)),
      0
    ) + COALESCE(NEW.quantity_tubes, 0);
  ELSE
    -- Fallback: use legacy quantity × units_per_box_snapshot for box sales
    IF NEW.sale_unit = 'box' THEN
      NEW.computed_tubes_total := NEW.quantity * COALESCE(NEW.units_per_box_snapshot, 1);
    ELSE
      -- Unit/tube sales: quantity IS tubes
      NEW.computed_tubes_total := NEW.quantity;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Drop if exists to avoid conflict
DROP TRIGGER IF EXISTS trg_compute_line_item_tubes ON public.invoice_line_items;

CREATE TRIGGER trg_compute_line_item_tubes
  BEFORE INSERT OR UPDATE ON public.invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION public.compute_line_item_tubes();

-- 6. Trigger: auto-update invoice total_tubes_sold and total_boxes_sold after line item changes
CREATE OR REPLACE FUNCTION public.update_invoice_tube_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_id uuid;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  UPDATE public.invoices
  SET 
    total_tubes_sold = COALESCE((
      SELECT SUM(computed_tubes_total) 
      FROM public.invoice_line_items 
      WHERE invoice_id = v_invoice_id
    ), 0),
    total_boxes_sold = COALESCE((
      SELECT SUM(COALESCE(quantity_boxes, 
        CASE WHEN sale_unit = 'box' THEN quantity ELSE 0 END
      ))
      FROM public.invoice_line_items 
      WHERE invoice_id = v_invoice_id
    ), 0)
  WHERE id = v_invoice_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_update_invoice_tube_totals ON public.invoice_line_items;

CREATE TRIGGER trg_update_invoice_tube_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION public.update_invoice_tube_totals();

-- 7. Index for tube_sale_ledger queries
CREATE INDEX IF NOT EXISTS idx_tube_sale_ledger_invoice ON public.tube_sale_ledger(invoice_id);
CREATE INDEX IF NOT EXISTS idx_tube_sale_ledger_store ON public.tube_sale_ledger(store_id);
CREATE INDEX IF NOT EXISTS idx_tube_sale_ledger_brand ON public.tube_sale_ledger(brand);
