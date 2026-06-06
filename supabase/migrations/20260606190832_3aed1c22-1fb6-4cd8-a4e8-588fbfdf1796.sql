CREATE TABLE IF NOT EXISTS public.dd_webhook_events (
  event_id text PRIMARY KEY,
  source text NOT NULL,
  type text,
  payload jsonb,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.dd_webhook_events TO service_role;
ALTER TABLE public.dd_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read webhook events" ON public.dd_webhook_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role));