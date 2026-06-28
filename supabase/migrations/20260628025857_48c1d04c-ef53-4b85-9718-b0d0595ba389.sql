DROP TRIGGER IF EXISTS tt_bookings_event_log ON public.tt_bookings;
DROP TRIGGER IF EXISTS tt_bookings_event_log_insert ON public.tt_bookings;
DROP TRIGGER IF EXISTS tt_bookings_event_log_update ON public.tt_bookings;

CREATE TRIGGER tt_bookings_event_log_insert
AFTER INSERT ON public.tt_bookings
FOR EACH ROW
EXECUTE FUNCTION public.log_booking_event();

CREATE TRIGGER tt_bookings_event_log_update
AFTER UPDATE ON public.tt_bookings
FOR EACH ROW
WHEN (
  OLD.status IS DISTINCT FROM NEW.status
  OR OLD.partner_id IS DISTINCT FROM NEW.partner_id
  OR OLD.decor_partner_id IS DISTINCT FROM NEW.decor_partner_id
  OR OLD.payment_status IS DISTINCT FROM NEW.payment_status
)
EXECUTE FUNCTION public.log_booking_event();