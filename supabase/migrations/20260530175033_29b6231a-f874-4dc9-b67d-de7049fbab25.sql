ALTER TABLE public.invoices DISABLE TRIGGER USER;
UPDATE public.invoices
SET customer_type = 'wholesaler'
WHERE id = '5a2f1037-4d41-4c14-ac5d-b4bbc951957e';
ALTER TABLE public.invoices ENABLE TRIGGER USER;