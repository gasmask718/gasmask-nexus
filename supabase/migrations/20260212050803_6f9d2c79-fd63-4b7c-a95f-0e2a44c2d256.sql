
-- ═══════════════════════════════════════════════════════════════════════════
-- LEGACY INVOICE EXACT TUBE ATTRIBUTION (Phases 1–3)
-- ═══════════════════════════════════════════════════════════════════════════

-- PHASE 1: Extend repair tables for exact attribution
ALTER TABLE public.historical_invoice_repairs
  ADD COLUMN IF NOT EXISTS source text;

ALTER TABLE public.historical_invoice_line_repairs
  ADD COLUMN IF NOT EXISTS attribution_method text;

ALTER TABLE public.historical_invoice_line_repairs
  ADD COLUMN IF NOT EXISTS unit_count integer;

COMMENT ON COLUMN public.historical_invoice_line_repairs.attribution_method IS
  'How the unit count was determined: manual_exact, price_derived, etc.';

COMMENT ON COLUMN public.historical_invoice_line_repairs.unit_count IS
  'Exact tube/bag count attributed to this legacy invoice.';

-- PHASE 3 SAFEGUARD: One exact repair per invoice max
CREATE UNIQUE INDEX IF NOT EXISTS uq_historical_invoice_line_repairs_exact
  ON public.historical_invoice_line_repairs (invoice_id)
  WHERE attribution_method = 'manual_exact';

-- Trigger: Cannot repair non-finalized invoices
CREATE OR REPLACE FUNCTION public.trg_guard_repair_finalized_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.invoices WHERE id = NEW.invoice_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Invoice % does not exist.', NEW.invoice_id;
  END IF;
  IF v_status <> 'finalized' THEN
    RAISE EXCEPTION 'Cannot repair invoice % — status is "%" (must be finalized).', NEW.invoice_id, v_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_line_repair_finalized_guard ON public.historical_invoice_line_repairs;
CREATE TRIGGER trg_line_repair_finalized_guard
  BEFORE INSERT ON public.historical_invoice_line_repairs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_guard_repair_finalized_only();

-- PHASE 2: Unified Read-Only Intelligence View
CREATE OR REPLACE VIEW public.v_invoice_effective_tubes AS

-- Modern path: real line items
SELECT
  ili.invoice_id,
  inv.invoice_number,
  inv.total,
  inv.created_at AS invoice_date,
  SUM(ili.quantity) AS tube_count,
  'live_line_item'::text AS source,
  NULL::text AS confidence_level
FROM public.invoice_line_items ili
JOIN public.invoices inv ON inv.id = ili.invoice_id
WHERE inv.status = 'finalized'
  AND inv.deleted_at IS NULL
GROUP BY ili.invoice_id, inv.invoice_number, inv.total, inv.created_at

UNION ALL

-- Legacy path: exact repair attributions
SELECT
  hlr.invoice_id,
  inv.invoice_number,
  inv.total,
  inv.created_at AS invoice_date,
  hlr.unit_count AS tube_count,
  'historical_exact_repair'::text AS source,
  hlr.confidence_level
FROM public.historical_invoice_line_repairs hlr
JOIN public.invoices inv ON inv.id = hlr.invoice_id
WHERE hlr.attribution_method = 'manual_exact'
  AND hlr.unit_count IS NOT NULL
  AND inv.status = 'finalized'
  AND inv.deleted_at IS NULL
  AND hlr.invoice_id NOT IN (
    SELECT DISTINCT invoice_id FROM public.invoice_line_items
  );

COMMENT ON VIEW public.v_invoice_effective_tubes IS
  'Unified tube count view. Modern invoices use real line items (live_line_item).
   Legacy invoices use exact operator-verified repair attributions (historical_exact_repair).
   Revenue, payments, and ledger history remain unchanged. Read-only intelligence only.';
