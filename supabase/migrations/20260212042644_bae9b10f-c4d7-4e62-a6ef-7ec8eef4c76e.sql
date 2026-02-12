
-- ═══════════════════════════════════════════════════════════════
-- HISTORICAL INVOICE REPAIR SCHEMA + CLASSIFICATION + FINALIZE GUARD
-- ═══════════════════════════════════════════════════════════════

-- 1) historical_invoice_repairs — tracks repair decisions per invoice
CREATE TABLE IF NOT EXISTS public.historical_invoice_repairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id),
  repair_type text NOT NULL CHECK (repair_type IN ('reconstructed_from_price', 'manual_override', 'unrecoverable')),
  confidence_level text CHECK (confidence_level IN ('high', 'medium', 'low')),
  reason text NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(invoice_id)
);

ALTER TABLE public.historical_invoice_repairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read historical repairs"
  ON public.historical_invoice_repairs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert historical repairs"
  ON public.historical_invoice_repairs FOR INSERT
  TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')
  );

-- 2) historical_invoice_line_repairs — reconstructed line-level quantities
CREATE TABLE IF NOT EXISTS public.historical_invoice_line_repairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  unit_type text NOT NULL,
  derived_quantity numeric NOT NULL DEFAULT 0,
  derived_units_total numeric NOT NULL DEFAULT 0,
  price_used numeric,
  price_source text CHECK (price_source IN ('store_price_list', 'brand_default', 'invoice_average', 'manual')),
  confidence_level text CHECK (confidence_level IN ('high', 'medium', 'low')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.historical_invoice_line_repairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read line repairs"
  ON public.historical_invoice_line_repairs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert line repairs"
  ON public.historical_invoice_line_repairs FOR INSERT
  TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')
  );

-- 3) v_historical_invoice_audit — classification view
CREATE OR REPLACE VIEW public.v_historical_invoice_audit AS
SELECT
  i.id AS invoice_id,
  i.invoice_number,
  i.status,
  i.store_id,
  i.due_date,
  i.total_amount,
  i.created_at,
  COALESCE(stats.line_count, 0) AS line_count,
  COALESCE(stats.has_null_qty, false) AS has_null_qty,
  COALESCE(stats.has_null_track_by, false) AS has_null_track_by,
  CASE
    WHEN i.status != 'finalized' THEN 'NOT_FINALIZED'
    WHEN COALESCE(stats.line_count, 0) = 0 AND COALESCE(i.total_amount, 0) > 0 THEN 'PRICE_ONLY'
    WHEN COALESCE(stats.line_count, 0) = 0 THEN 'EMPTY_FINALIZED'
    WHEN stats.has_null_qty OR stats.has_null_track_by THEN 'PARTIAL'
    ELSE 'CLEAN'
  END AS bucket,
  hir.id AS repair_id,
  hir.repair_type,
  hir.confidence_level AS repair_confidence,
  CASE WHEN hir.id IS NOT NULL THEN true ELSE false END AS has_historical_repair
FROM public.invoices i
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS line_count,
    BOOL_OR(li.quantity IS NULL OR li.quantity = 0) AS has_null_qty,
    BOOL_OR(p.track_by IS NULL) AS has_null_track_by
  FROM public.invoice_line_items li
  LEFT JOIN public.products p ON p.id = li.product_id
  WHERE li.invoice_id = i.id
) stats ON true
LEFT JOIN public.historical_invoice_repairs hir ON hir.invoice_id = i.id
WHERE i.deleted_at IS NULL;

COMMENT ON VIEW public.v_historical_invoice_audit IS 
'Classification view for historical invoice audit. Buckets: EMPTY_FINALIZED, PRICE_ONLY, PARTIAL, CLEAN, NOT_FINALIZED.';

-- 4) Finalize guard — block finalization of invoices with 0 line items
CREATE OR REPLACE FUNCTION public.trg_guard_empty_finalize()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_line_count integer;
BEGIN
  IF NEW.status = 'finalized' AND (OLD.status IS NULL OR OLD.status != 'finalized') THEN
    SELECT COUNT(*) INTO v_line_count
    FROM public.invoice_line_items
    WHERE invoice_id = NEW.id;
    
    IF v_line_count = 0 THEN
      RAISE EXCEPTION 'Cannot finalize invoice with zero line items. Invoice % has no line items.', 
        COALESCE(NEW.invoice_number, NEW.id::text);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_empty_finalize ON public.invoices;

CREATE TRIGGER trg_guard_empty_finalize
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_guard_empty_finalize();

COMMENT ON FUNCTION public.trg_guard_empty_finalize IS 
'Prevents finalization of invoices with zero line items.';
