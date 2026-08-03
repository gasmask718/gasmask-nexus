ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS amount_source text,
  ADD COLUMN IF NOT EXISTS amount_writeback_run_id uuid;