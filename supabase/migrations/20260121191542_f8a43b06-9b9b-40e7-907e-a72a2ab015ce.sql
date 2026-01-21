-- Drop the old constraint and add a new one that includes 'refunded'
ALTER TABLE public.invoices DROP CONSTRAINT invoices_payment_status_check;

ALTER TABLE public.invoices ADD CONSTRAINT invoices_payment_status_check 
CHECK (payment_status = ANY (ARRAY['unpaid'::text, 'partial'::text, 'paid'::text, 'overdue'::text, 'refunded'::text]));