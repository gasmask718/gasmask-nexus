
ALTER TABLE public.tt_bookings
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS auth_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tt_bookings_payment_hold_status
  ON public.tt_bookings(payment_hold_status)
  WHERE payment_hold_status IS NOT NULL AND payment_hold_status <> 'none';

CREATE INDEX IF NOT EXISTS idx_tt_bookings_auth_expires_at
  ON public.tt_bookings(auth_expires_at)
  WHERE payment_hold_status = 'hold_placed';

ALTER TABLE public.tt_service_routing
  ADD COLUMN IF NOT EXISTS auth_hold_window_minutes int NOT NULL DEFAULT 120;

-- Relax payment_hold_status check to include 'capture_failed' (new terminal-ish state).
ALTER TABLE public.tt_bookings DROP CONSTRAINT IF EXISTS tt_bookings_payment_hold_status_check;
ALTER TABLE public.tt_bookings ADD CONSTRAINT tt_bookings_payment_hold_status_check
  CHECK (payment_hold_status = ANY (ARRAY['none','hold_placed','charged','released','capture_failed']));

-- Flip helicopter to fixed/auto_dispatch to match slingshot/jetski.
UPDATE public.tt_service_routing
  SET pricing_strategy='fixed', fulfillment_model='auto_dispatch'
  WHERE slug='helicopter';
