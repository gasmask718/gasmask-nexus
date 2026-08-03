ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS line_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS reconstruction_run_id uuid;

COMMENT ON COLUMN public.invoice_line_items.line_source IS
  'Provenance: manual | parsed_from_note | imported';
COMMENT ON COLUMN public.invoice_line_items.reconstruction_run_id IS
  'Batch id from invoice_line_reconstruction_staging.run_id. Enables one-statement rollback.';

CREATE INDEX IF NOT EXISTS idx_ili_reconstruction_run
  ON public.invoice_line_items (reconstruction_run_id)
  WHERE reconstruction_run_id IS NOT NULL;
