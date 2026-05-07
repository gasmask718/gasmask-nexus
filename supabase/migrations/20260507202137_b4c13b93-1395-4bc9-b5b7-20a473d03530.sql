
CREATE TABLE public.brandaro_number_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number_id UUID NOT NULL REFERENCES public.brandaro_phone_numbers(id) ON DELETE CASCADE,
  va_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_brandaro_number_sessions_number ON public.brandaro_number_sessions(number_id, started_at DESC);
CREATE INDEX idx_brandaro_number_sessions_va ON public.brandaro_number_sessions(va_id);
CREATE INDEX idx_brandaro_number_sessions_active ON public.brandaro_number_sessions(number_id) WHERE ended_at IS NULL;

ALTER TABLE public.brandaro_number_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all number sessions"
  ON public.brandaro_number_sessions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "VAs view own number sessions"
  ON public.brandaro_number_sessions FOR SELECT
  USING (va_id = auth.uid());

CREATE POLICY "VAs create own number sessions"
  ON public.brandaro_number_sessions FOR INSERT
  WITH CHECK (va_id = auth.uid());

CREATE POLICY "VAs end own number sessions"
  ON public.brandaro_number_sessions FOR UPDATE
  USING (va_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE VIEW public.brandaro_number_last_sessions
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (n.id)
  n.id AS number_id,
  n.phone_number,
  n.friendly_name,
  n.in_use,
  n.assigned_va_id,
  s.id AS session_id,
  s.va_id AS last_va_id,
  s.started_at,
  s.ended_at
FROM public.brandaro_phone_numbers n
LEFT JOIN public.brandaro_number_sessions s ON s.number_id = n.id
ORDER BY n.id, s.started_at DESC NULLS LAST;
