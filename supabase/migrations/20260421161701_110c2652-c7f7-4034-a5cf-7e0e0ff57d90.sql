ALTER TABLE public.va_invoices
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_send_error TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_va_invoices_invoice_number
  ON public.va_invoices(invoice_number)
  WHERE invoice_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.va_invoices_assign_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yr TEXT;
  next_seq INT;
BEGIN
  IF NEW.invoice_number IS NOT NULL AND NEW.invoice_number <> '' THEN
    RETURN NEW;
  END IF;
  yr := to_char(COALESCE(NEW.created_at, now()), 'YYYY');
  SELECT COALESCE(MAX( (regexp_replace(invoice_number, '^INV-' || yr || '-', ''))::int ), 0) + 1
    INTO next_seq
    FROM public.va_invoices
    WHERE invoice_number LIKE 'INV-' || yr || '-%';
  NEW.invoice_number := 'INV-' || yr || '-' || lpad(next_seq::text, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_va_invoices_assign_number ON public.va_invoices;
CREATE TRIGGER trg_va_invoices_assign_number
  BEFORE INSERT ON public.va_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.va_invoices_assign_number();

-- Backfill existing rows
DO $$
DECLARE
  r RECORD;
  yr TEXT;
  next_seq INT;
BEGIN
  FOR r IN SELECT id, created_at FROM public.va_invoices WHERE invoice_number IS NULL ORDER BY created_at ASC
  LOOP
    yr := to_char(COALESCE(r.created_at, now()), 'YYYY');
    SELECT COALESCE(MAX( (regexp_replace(invoice_number, '^INV-' || yr || '-', ''))::int ), 0) + 1
      INTO next_seq
      FROM public.va_invoices
      WHERE invoice_number LIKE 'INV-' || yr || '-%';
    UPDATE public.va_invoices
       SET invoice_number = 'INV-' || yr || '-' || lpad(next_seq::text, 4, '0')
     WHERE id = r.id;
  END LOOP;
END $$;