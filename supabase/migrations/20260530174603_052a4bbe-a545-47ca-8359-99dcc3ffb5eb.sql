ALTER TABLE public.invoices DISABLE TRIGGER USER;

UPDATE public.invoices
SET is_historical = true
WHERE store_id IS NULL
  AND id <> '5a2f1037-4d41-4c14-ac5d-b4bbc951957e'
  AND (created_by = 'sample_seed' OR created_by IS NULL OR invoice_number LIKE 'INV-SEED-%' OR invoice_number IN ('INV-2024-001','INV-2024-W01','INV-2024-D01'));

ALTER TABLE public.invoices ENABLE TRIGGER USER;