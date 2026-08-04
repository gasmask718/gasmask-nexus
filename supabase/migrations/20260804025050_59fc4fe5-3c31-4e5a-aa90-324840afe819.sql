ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS total_amount_source text NOT NULL DEFAULT 'recorded',
  ADD COLUMN IF NOT EXISTS total_amount_source_note text;

COMMENT ON COLUMN public.invoices.total_amount_source IS
  'Provenance of total_amount. ''recorded'' = entered at time of sale. ''note_parse'' = amount transcribed from invoices.notes during a reconciliation run; it is a transcription of a written note, NOT an amount captured at point of sale.';

COMMENT ON COLUMN public.invoices.total_amount_source_note IS
  'reconstruction_run_id of the reconciliation run that set total_amount when total_amount_source = ''note_parse''. Enables single-statement rollback of a run.';

-- Backfill the already-applied high-confidence run (168 rows, $23,900)
UPDATE public.invoices
SET total_amount_source = 'note_parse',
    total_amount_source_note = 'c9f4a2d7-1e83-4b60-9a5f-2d7e6c1b40aa'
WHERE amount_source = 'parsed_from_note'
  AND total_amount_source = 'recorded';