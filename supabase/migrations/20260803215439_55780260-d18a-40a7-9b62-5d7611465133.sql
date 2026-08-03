ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS delete_reason text;

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_live
  ON public.invoice_line_items (invoice_id)
  WHERE deleted_at IS NULL;