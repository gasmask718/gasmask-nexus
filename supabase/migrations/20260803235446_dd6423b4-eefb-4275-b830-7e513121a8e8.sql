CREATE OR REPLACE FUNCTION public.derive_unit_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.unit_type := CASE COALESCE(NEW.sale_unit, 'unit')
    WHEN 'box' THEN 'BOX'
    WHEN 'pack' THEN 'PACK'
    ELSE 'TUBE'
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_derive_unit_type ON public.invoice_line_items;
CREATE TRIGGER trg_derive_unit_type
BEFORE INSERT OR UPDATE OF sale_unit, quantity ON public.invoice_line_items
FOR EACH ROW EXECUTE FUNCTION public.derive_unit_type();