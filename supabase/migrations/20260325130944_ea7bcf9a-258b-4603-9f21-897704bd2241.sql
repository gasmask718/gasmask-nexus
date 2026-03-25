
ALTER TABLE public.solar_followups
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_solar_followups_pending_send
  ON public.solar_followups (send_time)
  WHERE status = 'pending' AND delivery_status = 'pending';
