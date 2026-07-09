CREATE OR REPLACE FUNCTION public.auto_log_label_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.shipping_label_events (label_id, fulfillment_id, event_type, actor_user_id, meta_json)
  VALUES (
    NEW.id,
    NULL,
    CASE
      WHEN TG_OP = 'INSERT' THEN 'created'
      WHEN TG_OP = 'UPDATE' AND NEW.status = 'voided' AND OLD.status IS DISTINCT FROM 'voided' THEN 'voided'
      ELSE 'updated'
    END,
    auth.uid(),
    jsonb_build_object('order_id', NEW.order_id, 'carrier', NEW.carrier, 'tracking', NEW.tracking_number, 'status', NEW.status)
  );
  RETURN NEW;
END;
$function$;