
-- Update guard to also exempt repair operations
CREATE OR REPLACE FUNCTION public.trg_guard_empty_finalize()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_line_count integer;
BEGIN
  IF NEW.status = 'finalized' AND (OLD.status IS NULL OR OLD.status != 'finalized') THEN
    -- Historical invoices are exempt from line-item requirement
    IF NEW.is_historical = true THEN
      RETURN NEW;
    END IF;
    
    -- System repair operations are exempt
    IF NEW.finalized_by = 'system_repair_v1' OR NEW.finalized_by = 'auto_status_sync' THEN
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
