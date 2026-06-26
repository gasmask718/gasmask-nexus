
ALTER TABLE public.tt_bookings
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tt_bookings_scheduled_confirmed
  ON public.tt_bookings(scheduled_at)
  WHERE status = 'confirmed';
