-- Auto-Dialer + Bland AI rebuild: schema additions

ALTER TABLE public.outbound_call_queue
  ADD COLUMN IF NOT EXISTS bland_call_id text,
  ADD COLUMN IF NOT EXISTS bland_recording_url text,
  ADD COLUMN IF NOT EXISTS bland_transcript text,
  ADD COLUMN IF NOT EXISTS confirmation_method text,
  ADD COLUMN IF NOT EXISTS confirmation_value text,
  ADD COLUMN IF NOT EXISTS bridged_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ocq_twilio_call_sid ON public.outbound_call_queue(twilio_call_sid);
CREATE INDEX IF NOT EXISTS idx_ocq_bland_call_id ON public.outbound_call_queue(bland_call_id);

ALTER TABLE public.dialer_campaigns
  ADD COLUMN IF NOT EXISTS bridge_mode text NOT NULL DEFAULT 'bland_did',
  ADD COLUMN IF NOT EXISTS confirmation_prompt text,
  ADD COLUMN IF NOT EXISTS confirmation_retries integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.dialer_call_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid,
  campaign_id uuid,
  queue_item_id uuid,
  call_sid text,
  event_type text NOT NULL,
  source text NOT NULL DEFAULT 'twilio',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dce_campaign_created ON public.dialer_call_events(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dce_call_sid ON public.dialer_call_events(call_sid);
CREATE INDEX IF NOT EXISTS idx_dce_queue_item ON public.dialer_call_events(queue_item_id);

ALTER TABLE public.dialer_call_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on dialer_call_events"
  ON public.dialer_call_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users read dialer_call_events for their business"
  ON public.dialer_call_events
  FOR SELECT
  TO authenticated
  USING (
    business_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.business_members bm
      WHERE bm.user_id = auth.uid() AND bm.business_id = dialer_call_events.business_id
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dialer_call_events;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END$$;

ALTER TABLE public.dialer_call_events REPLICA IDENTITY FULL;
ALTER TABLE public.outbound_call_queue REPLICA IDENTITY FULL;