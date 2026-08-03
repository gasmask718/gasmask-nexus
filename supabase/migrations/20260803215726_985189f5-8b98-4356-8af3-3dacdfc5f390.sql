CREATE OR REPLACE FUNCTION public.update_invoice_tube_totals()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice_id uuid;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  UPDATE public.invoices
  SET
    total_tubes_sold = COALESCE((
      SELECT SUM(computed_tubes_total)
      FROM public.invoice_line_items
      WHERE invoice_id = v_invoice_id AND deleted_at IS NULL
    ), 0),
    total_boxes_sold = COALESCE((
      SELECT SUM(COALESCE(quantity_boxes,
        CASE WHEN sale_unit = 'box' THEN quantity ELSE 0 END
      ))
      FROM public.invoice_line_items
      WHERE invoice_id = v_invoice_id AND deleted_at IS NULL
    ), 0)
  WHERE id = v_invoice_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;