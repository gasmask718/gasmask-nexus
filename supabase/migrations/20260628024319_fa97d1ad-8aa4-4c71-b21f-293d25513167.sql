CREATE OR REPLACE FUNCTION public.log_booking_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_safe_snapshot jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- PII-safe snapshot: explicitly whitelist non-sensitive fields only.
    -- Excludes: client_name, client_email, client_phone, stripe_payment_intent_id,
    -- special_requests, notes, auth_expires_at, lat/lng coords.
    v_safe_snapshot := jsonb_build_object(
      'id', NEW.id,
      'service_type', NEW.service_type,
      'service_name', NEW.service_name,
      'service_slug', NEW.service_slug,
      'status', NEW.status,
      'scheduled_at', NEW.scheduled_at,
      'total_price', NEW.total_price,
      'pickup_city', NEW.pickup_city,
      'dropoff_city', NEW.dropoff_city,
      'pickup_state', NEW.pickup_state,
      'passenger_count', NEW.passenger_count,
      'partner_id', NEW.partner_id,
      'partner_name', NEW.partner_name,
      'decor_partner_id', NEW.decor_partner_id,
      'decor_addon', NEW.decor_addon,
      'decor_package_slug', NEW.decor_package_slug,
      'vehicle_id', NEW.vehicle_id,
      'vehicle_name', NEW.vehicle_name,
      'driver_id', NEW.driver_id,
      'fulfillment_model', NEW.fulfillment_model,
      'payment_status', NEW.payment_status,
      'payment_hold_status', NEW.payment_hold_status,
      'dispatch_method', NEW.dispatch_method,
      'dispatched_to', NEW.dispatched_to,
      'source', NEW.source,
      'booking_reference', NEW.booking_reference,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    );

    INSERT INTO public.booking_events (booking_id, event_type, new_state, actor_type, actor_label)
    VALUES (NEW.id, 'created', v_safe_snapshot, 'system', 'New booking inserted');
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.booking_events (booking_id, event_type, previous_state, new_state, actor_type, actor_label, metadata)
      VALUES (
        NEW.id, 'status_changed',
        jsonb_build_object('status', OLD.status),
        jsonb_build_object('status', NEW.status),
        'system',
        format('Status: %s → %s', OLD.status, NEW.status),
        jsonb_build_object('from', OLD.status, 'to', NEW.status)
      );

      IF NEW.status = 'completed' THEN
        INSERT INTO public.booking_events (booking_id, event_type, actor_type, actor_label)
        VALUES (NEW.id, 'completed', 'system', 'Booking marked complete');
      ELSIF NEW.status = 'cancelled' THEN
        INSERT INTO public.booking_events (booking_id, event_type, actor_type, actor_label)
        VALUES (NEW.id, 'cancelled', 'system', 'Booking cancelled');
      END IF;
    END IF;

    IF OLD.partner_id IS DISTINCT FROM NEW.partner_id AND NEW.partner_id IS NOT NULL THEN
      INSERT INTO public.booking_events (booking_id, event_type, new_state, actor_type, actor_label)
      VALUES (
        NEW.id, 'assigned_to_partner',
        jsonb_build_object('partner_id', NEW.partner_id, 'partner_name', NEW.partner_name),
        'system',
        format('Partner assigned: %s', COALESCE(NEW.partner_name, NEW.partner_id::text))
      );
    END IF;

    IF OLD.decor_partner_id IS DISTINCT FROM NEW.decor_partner_id AND NEW.decor_partner_id IS NOT NULL THEN
      INSERT INTO public.booking_events (booking_id, event_type, new_state, actor_type, actor_label)
      VALUES (
        NEW.id, 'assigned_to_decorator',
        jsonb_build_object('decor_partner_id', NEW.decor_partner_id),
        'system',
        format('Decorator assigned: %s', NEW.decor_partner_id)
      );
    END IF;

    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
      INSERT INTO public.booking_events (booking_id, event_type, previous_state, new_state, actor_type, actor_label)
      VALUES (
        NEW.id,
        CASE
          WHEN NEW.payment_status IN ('captured','paid','succeeded') THEN 'payment_captured'
          WHEN NEW.payment_status IN ('failed','declined') THEN 'payment_failed'
          ELSE 'payment_status_changed'
        END,
        jsonb_build_object('payment_status', OLD.payment_status),
        jsonb_build_object('payment_status', NEW.payment_status),
        'system',
        format('Payment: %s → %s', OLD.payment_status, NEW.payment_status)
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$function$;

-- Defensive scrub of any historical rows that may contain PII (table is currently empty; no-op but safe).
UPDATE public.booking_events
SET new_state = new_state
  - 'client_email' - 'client_phone' - 'client_name'
  - 'stripe_payment_intent_id' - 'special_requests' - 'notes'
WHERE new_state ?| ARRAY['client_email','client_phone','client_name','stripe_payment_intent_id','special_requests','notes'];

UPDATE public.booking_events
SET previous_state = previous_state
  - 'client_email' - 'client_phone' - 'client_name'
  - 'stripe_payment_intent_id' - 'special_requests' - 'notes'
WHERE previous_state ?| ARRAY['client_email','client_phone','client_name','stripe_payment_intent_id','special_requests','notes'];