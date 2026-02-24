
-- Phase E: Twilio Voice Bridge Integration Schema

-- 1. Twilio Call Logs (audit every callback)
CREATE TABLE IF NOT EXISTS public.twilio_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id),
  queue_item_id uuid,
  call_sid text,
  direction text DEFAULT 'outbound',
  to_number text,
  from_number text,
  status text,
  duration integer,
  raw_payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.twilio_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view twilio logs"
  ON public.twilio_call_logs FOR SELECT
  USING (business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  ));

-- 2. Feature flags on dialer_settings
ALTER TABLE public.dialer_settings
  ADD COLUMN IF NOT EXISTS telephony_mode text DEFAULT 'simulation' CHECK (telephony_mode IN ('simulation', 'live')),
  ADD COLUMN IF NOT EXISTS twilio_enabled boolean DEFAULT false;

-- 3. Add twilio_call_sid to outbound_call_queue for tracking
ALTER TABLE public.outbound_call_queue
  ADD COLUMN IF NOT EXISTS twilio_call_sid text;

-- 4. Add twilio_call_sid to live_call_sessions
ALTER TABLE public.live_call_sessions
  ADD COLUMN IF NOT EXISTS twilio_call_sid text;

-- 5. Enable realtime on twilio_call_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.twilio_call_logs;
