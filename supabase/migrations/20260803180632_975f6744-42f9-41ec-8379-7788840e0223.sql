-- ═══════════════════════════════════════════════════════════════════════════
-- Flower seller flag: align to store_master (what StoreMasterProfile reads)
-- Additive only. public.stores.sells_flowers is intentionally left in place
-- for the legacy /StoreDetail page.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.store_master
  ADD COLUMN IF NOT EXISTS sells_flowers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sells_flowers_note text,
  ADD COLUMN IF NOT EXISTS sells_flowers_flagged_by uuid,
  ADD COLUMN IF NOT EXISTS sells_flowers_flagged_at timestamptz;

COMMENT ON COLUMN public.store_master.sells_flowers IS
  'Prospecting attribute: does this store buy flower? Not a sales record. Sales live in invoices/invoice_line_items.';

-- Demand-list query shape: filter on the flag, order by when it was flagged.
CREATE INDEX IF NOT EXISTS idx_store_master_sells_flowers
  ON public.store_master (sells_flowers, sells_flowers_flagged_at DESC)
  WHERE sells_flowers;

-- ── Attribution is stamped server-side so it cannot be spoofed or forgotten ──
CREATE OR REPLACE FUNCTION public.stamp_sells_flowers_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.sells_flowers THEN
      NEW.sells_flowers_flagged_by := COALESCE(NEW.sells_flowers_flagged_by, auth.uid());
      NEW.sells_flowers_flagged_at := COALESCE(NEW.sells_flowers_flagged_at, now());
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.sells_flowers IS DISTINCT FROM OLD.sells_flowers THEN
    IF NEW.sells_flowers THEN
      NEW.sells_flowers_flagged_by := COALESCE(auth.uid(), NEW.sells_flowers_flagged_by);
      NEW.sells_flowers_flagged_at := now();
    ELSE
      NEW.sells_flowers_flagged_by := NULL;
      NEW.sells_flowers_flagged_at := NULL;
      NEW.sells_flowers_note := NULL;
    END IF;
  ELSIF NEW.sells_flowers
        AND NEW.sells_flowers_note IS DISTINCT FROM OLD.sells_flowers_note THEN
    -- note edited on an already-flagged store: refresh who/when
    NEW.sells_flowers_flagged_by := COALESCE(auth.uid(), NEW.sells_flowers_flagged_by);
    NEW.sells_flowers_flagged_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_sells_flowers ON public.store_master;
CREATE TRIGGER trg_stamp_sells_flowers
  BEFORE INSERT OR UPDATE ON public.store_master
  FOR EACH ROW EXECUTE FUNCTION public.stamp_sells_flowers_attribution();

-- ── Widen update access to match the component contract ──────────────────────
-- Existing: is_staff() (admin/owner/employee) + va_update_store_master_scoped.
-- Missing: ambassador and biker. Driver stays read-only by omission.
DROP POLICY IF EXISTS store_master_update_ambassador_biker ON public.store_master;
CREATE POLICY store_master_update_ambassador_biker
  ON public.store_master
  FOR UPDATE
  TO authenticated
  USING (
    (
      has_role(auth.uid(), 'ambassador'::app_role)
      OR has_role(auth.uid(), 'biker'::app_role)
    )
    AND (
      business_id IS NULL
      OR has_business_role(auth.uid(), 'ambassador'::text, business_id)
      OR has_business_role(auth.uid(), 'biker'::text, business_id)
    )
  )
  WITH CHECK (
    (
      has_role(auth.uid(), 'ambassador'::app_role)
      OR has_role(auth.uid(), 'biker'::app_role)
    )
    AND (
      business_id IS NULL
      OR has_business_role(auth.uid(), 'ambassador'::text, business_id)
      OR has_business_role(auth.uid(), 'biker'::text, business_id)
    )
  );