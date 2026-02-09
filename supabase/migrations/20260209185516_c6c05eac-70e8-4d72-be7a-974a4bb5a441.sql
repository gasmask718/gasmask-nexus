
-- Add soft-delete columns to invoices table (GDS v1.0)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS delete_reason TEXT;

-- Index for filtering active invoices
CREATE INDEX IF NOT EXISTS idx_invoices_not_deleted ON public.invoices(deleted_at) WHERE deleted_at IS NULL;
