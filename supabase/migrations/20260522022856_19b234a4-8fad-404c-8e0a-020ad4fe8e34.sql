ALTER TABLE public.tt_bookings
  ADD COLUMN IF NOT EXISTS requested_style text,
  ADD COLUMN IF NOT EXISTS pickup_state    text;

ALTER TABLE public.tt_dispatch_requests
  ADD COLUMN IF NOT EXISTS dispatch_pattern text,
  ADD COLUMN IF NOT EXISTS payment_leg      text;

CREATE INDEX IF NOT EXISTS idx_tt_dispatch_requests_pattern
  ON public.tt_dispatch_requests(dispatch_pattern);