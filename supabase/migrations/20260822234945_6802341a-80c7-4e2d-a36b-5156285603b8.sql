ALTER TABLE public.ut_event_bookings
  ADD COLUMN IF NOT EXISTS source_booking_id text,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'unforgettable';

COMMENT ON COLUMN public.ut_event_bookings.source_booking_id IS 'Idempotency key: originating platform booking id (e.g. TopTier). NULL for native UT bookings.';
COMMENT ON COLUMN public.ut_event_bookings.source IS 'Originating platform: unforgettable (native) or toptier.';

CREATE UNIQUE INDEX IF NOT EXISTS ut_event_bookings_source_booking_id_key
  ON public.ut_event_bookings (source_booking_id);