ALTER TABLE public.tt_bookings DROP CONSTRAINT IF EXISTS tt_bookings_fulfillment_model_check;
ALTER TABLE public.tt_bookings
  ADD CONSTRAINT tt_bookings_fulfillment_model_check
  CHECK (fulfillment_model = ANY (ARRAY[
    'auto_dispatch'::text,
    'quote_then_dispatch'::text,
    'manual'::text,
    'request_confirm'::text,
    'quote_broadcast'::text
  ]));