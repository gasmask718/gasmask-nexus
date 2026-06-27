
-- 1. booking_events table
CREATE TABLE IF NOT EXISTS public.booking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  previous_state JSONB,
  new_state JSONB,
  actor_id UUID,
  actor_type TEXT,
  actor_label TEXT,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_events_booking_id ON public.booking_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_events_event_type ON public.booking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_booking_events_created_at ON public.booking_events(created_at DESC);

GRANT SELECT ON public.booking_events TO authenticated;
GRANT ALL ON public.booking_events TO service_role;

ALTER TABLE public.booking_events ENABLE ROW LEVEL SECURITY;

-- Admins/owners can view all events
CREATE POLICY "Admins view all booking events"
ON public.booking_events FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'owner'::app_role)
);

-- Customers can view events for bookings tied to their email
CREATE POLICY "Customers view own booking events"
ON public.booking_events FOR SELECT
TO authenticated
USING (
  booking_id IN (
    SELECT id FROM public.tt_bookings
    WHERE client_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- 2. Trigger function for automatic logging on tt_bookings
CREATE OR REPLACE FUNCTION public.log_booking_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.booking_events (booking_id, event_type, new_state, actor_type, actor_label)
    VALUES (NEW.id, 'created', to_jsonb(NEW), 'system', 'New booking inserted');
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Status transitions
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.booking_events (booking_id, event_type, previous_state, new_state, actor_type, actor_label, metadata)
      VALUES (
        NEW.id,
        'status_changed',
        jsonb_build_object('status', OLD.status),
        jsonb_build_object('status', NEW.status),
        'system',
        format('Status: %s → %s', OLD.status, NEW.status),
        jsonb_build_object('from', OLD.status, 'to', NEW.status)
      );

      -- Specialized status events
      IF NEW.status = 'completed' THEN
        INSERT INTO public.booking_events (booking_id, event_type, actor_type, actor_label)
        VALUES (NEW.id, 'completed', 'system', 'Booking marked complete');
      ELSIF NEW.status = 'cancelled' THEN
        INSERT INTO public.booking_events (booking_id, event_type, actor_type, actor_label)
        VALUES (NEW.id, 'cancelled', 'system', 'Booking cancelled');
      END IF;
    END IF;

    -- Partner assignment
    IF OLD.partner_id IS DISTINCT FROM NEW.partner_id AND NEW.partner_id IS NOT NULL THEN
      INSERT INTO public.booking_events (booking_id, event_type, new_state, actor_type, actor_label)
      VALUES (
        NEW.id,
        'assigned_to_partner',
        jsonb_build_object('partner_id', NEW.partner_id, 'partner_name', NEW.partner_name),
        'system',
        format('Partner assigned: %s', COALESCE(NEW.partner_name, NEW.partner_id::text))
      );
    END IF;

    -- Decorator (decor partner) assignment
    IF OLD.decor_partner_id IS DISTINCT FROM NEW.decor_partner_id AND NEW.decor_partner_id IS NOT NULL THEN
      INSERT INTO public.booking_events (booking_id, event_type, new_state, actor_type, actor_label)
      VALUES (
        NEW.id,
        'assigned_to_decorator',
        jsonb_build_object('decor_partner_id', NEW.decor_partner_id),
        'system',
        format('Decorator assigned: %s', NEW.decor_partner_id)
      );
    END IF;

    -- Payment status transitions
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
$$;

DROP TRIGGER IF EXISTS tt_bookings_event_log ON public.tt_bookings;
CREATE TRIGGER tt_bookings_event_log
AFTER INSERT OR UPDATE ON public.tt_bookings
FOR EACH ROW EXECUTE FUNCTION public.log_booking_event();
