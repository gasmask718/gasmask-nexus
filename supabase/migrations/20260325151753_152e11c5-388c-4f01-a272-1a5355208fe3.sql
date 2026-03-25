
-- Create repair log table
CREATE TABLE IF NOT EXISTS public.invoice_repair_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  repair_reason text NOT NULL,
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL,
  repaired_by text DEFAULT 'system',
  repaired_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_repair_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view repair log"
  ON public.invoice_repair_log FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "System can insert repair log"
  ON public.invoice_repair_log FOR INSERT
  TO authenticated WITH CHECK (true);

-- Log repairs BEFORE updating (capture draft state)
INSERT INTO public.invoice_repair_log (invoice_id, repair_reason, before_state, after_state, repaired_by)
SELECT 
  id,
  'status_mismatch: draft+' || payment_status || ' auto-normalized to finalized',
  jsonb_build_object('status', status, 'payment_status', payment_status, 'is_historical', is_historical),
  jsonb_build_object('status', 'finalized', 'payment_status', payment_status, 'is_historical', is_historical),
  'system_repair_v1'
FROM invoices
WHERE status = 'draft' AND payment_status IN ('paid', 'partial');

-- Normalize all draft+paid
UPDATE invoices 
SET status = 'finalized', 
    finalized_at = COALESCE(finalized_at, paid_at, created_at),
    finalized_by = 'system_repair_v1',
    repair_status = 'normalized',
    repair_notes = 'draft+paid mismatch auto-finalized',
    repaired_at = now(),
    repaired_by = 'system_repair_v1'
WHERE status = 'draft' AND payment_status = 'paid';

-- Normalize all draft+partial
UPDATE invoices 
SET status = 'finalized',
    finalized_at = COALESCE(finalized_at, created_at),
    finalized_by = 'system_repair_v1',
    repair_status = 'normalized',
    repair_notes = 'draft+partial mismatch auto-finalized',
    repaired_at = now(),
    repaired_by = 'system_repair_v1'
WHERE status = 'draft' AND payment_status = 'partial';

-- Future mismatch prevention trigger
CREATE OR REPLACE FUNCTION public.validate_invoice_status_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.payment_status IN ('paid', 'partial', 'refunded') AND NEW.status = 'draft' THEN
    NEW.status := 'finalized';
    NEW.finalized_at := COALESCE(NEW.finalized_at, now());
    NEW.finalized_by := COALESCE(NEW.finalized_by, 'auto_status_sync');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_status_consistency ON public.invoices;

CREATE TRIGGER trg_invoice_status_consistency
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_invoice_status_consistency();
