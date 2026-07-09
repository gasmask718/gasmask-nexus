CREATE OR REPLACE FUNCTION public.guard_single_active_label()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'created' AND EXISTS (
    SELECT 1 FROM public.shipping_labels
    WHERE order_id = NEW.order_id
      AND status = 'created'
      AND id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'An active shipping label already exists for this order. Void it first.';
  END IF;
  RETURN NEW;
END;
$function$;