
-- Step 1: Add the column
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS entry_mode text DEFAULT 'live';
ALTER TABLE public.customer_invoices ADD COLUMN IF NOT EXISTS entry_mode text DEFAULT 'live';

-- Step 2: Update guard to allow entry_mode changes on finalized invoices
CREATE OR REPLACE FUNCTION public.guard_finalized_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'invoices' THEN
    IF OLD.status = 'finalized' THEN
      IF NEW.status IS DISTINCT FROM OLD.status
         OR NEW.voided_at IS DISTINCT FROM OLD.voided_at
         OR NEW.void_reason IS DISTINCT FROM OLD.void_reason
         OR NEW.voided_by IS DISTINCT FROM OLD.voided_by
         OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
         OR NEW.amount_paid IS DISTINCT FROM OLD.amount_paid
         OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
         OR NEW.partial_amount IS DISTINCT FROM OLD.partial_amount
         OR NEW.receipt_sent_at IS DISTINCT FROM OLD.receipt_sent_at
         OR NEW.receipt_status IS DISTINCT FROM OLD.receipt_status
         OR NEW.receipt_message_sid IS DISTINCT FROM OLD.receipt_message_sid
         OR NEW.receipt_delivered_at IS DISTINCT FROM OLD.receipt_delivered_at
         OR NEW.receipt_failure_reason IS DISTINCT FROM OLD.receipt_failure_reason
         OR NEW.receipt_phone_used IS DISTINCT FROM OLD.receipt_phone_used
         OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
         OR NEW.deleted_by IS DISTINCT FROM OLD.deleted_by
         OR NEW.delete_reason IS DISTINCT FROM OLD.delete_reason
         OR NEW.repair_status IS DISTINCT FROM OLD.repair_status
         OR NEW.repair_notes IS DISTINCT FROM OLD.repair_notes
         OR NEW.repaired_at IS DISTINCT FROM OLD.repaired_at
         OR NEW.repaired_by IS DISTINCT FROM OLD.repaired_by
         OR NEW.entry_mode IS DISTINCT FROM OLD.entry_mode
      THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Cannot modify a finalized invoice. Void it first to make corrections.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Step 3: Backfill
UPDATE invoices SET entry_mode = 'backfill' WHERE is_historical = true;
UPDATE customer_invoices SET entry_mode = 'backfill' WHERE is_historical = true;

-- Step 4: Index
CREATE INDEX IF NOT EXISTS idx_invoices_entry_mode ON public.invoices(entry_mode);
