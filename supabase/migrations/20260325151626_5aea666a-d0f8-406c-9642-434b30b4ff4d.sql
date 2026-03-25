
-- Only update the guard function - no data changes
CREATE OR REPLACE FUNCTION public.trg_guard_empty_finalize()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_line_count integer;
BEGIN
  IF NEW.status = 'finalized' AND (OLD.status IS NULL OR OLD.status != 'finalized') THEN
    -- Historical invoices and system repairs are exempt from line-item requirement
    IF NEW.is_historical = true THEN
      RETURN NEW;
    END IF;
    
    SELECT COUNT(*) INTO v_line_count
    FROM public.invoice_line_items
    WHERE invoice_id = NEW.id;

    IF v_line_count = 0 THEN
      RAISE EXCEPTION 'Cannot finalize invoice with zero line items. Invoice % has no line items.',
        COALESCE(NEW.invoice_number, NEW.id::text);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
