
-- Since due_date is a 'date' type and we can't use a simple column default 
-- that references another column, we use a BEFORE INSERT trigger to guarantee 
-- due_date is always populated (Net 30 from created_at).

CREATE OR REPLACE FUNCTION public.set_invoice_due_date_default()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.due_date IS NULL THEN
    NEW.due_date := COALESCE(NEW.created_at::date, CURRENT_DATE) + INTERVAL '30 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_invoice_due_date_default
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_invoice_due_date_default();

-- Also make the column nullable so the trigger can fill it in,
-- rather than Postgres rejecting the row before the trigger fires.
-- Actually, BEFORE INSERT triggers fire before constraints, so we need to 
-- allow NULL temporarily. Let's change to allow NULL + trigger fills it.
ALTER TABLE public.invoices ALTER COLUMN due_date DROP NOT NULL;
