CREATE TABLE public.recruiting_intake_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  email_norm text,
  outcome text NOT NULL DEFAULT 'accepted',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.recruiting_intake_events TO service_role;
ALTER TABLE public.recruiting_intake_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view intake events" ON public.recruiting_intake_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));
CREATE INDEX idx_recruiting_intake_events_ip_time ON public.recruiting_intake_events (ip_hash, created_at DESC);