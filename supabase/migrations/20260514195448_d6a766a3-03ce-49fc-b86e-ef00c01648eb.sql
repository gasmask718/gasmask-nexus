
CREATE TABLE public.va_intake_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  va_id UUID NOT NULL,
  business_name TEXT,
  owner_name TEXT,
  phone TEXT,
  email TEXT,
  sent_via TEXT[] NOT NULL DEFAULT '{}',
  sms_status TEXT,
  sms_error TEXT,
  email_status TEXT,
  email_error TEXT,
  destination_url TEXT NOT NULL DEFAULT 'https://www.brandarodigital.com/intake',
  status TEXT NOT NULL DEFAULT 'sent',
  accessed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_va_intake_invites_va ON public.va_intake_invites(va_id, created_at DESC);
CREATE INDEX idx_va_intake_invites_token ON public.va_intake_invites(token);

ALTER TABLE public.va_intake_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "VAs see their own intake invites"
  ON public.va_intake_invites FOR SELECT TO authenticated
  USING (va_id = auth.uid());

CREATE POLICY "VAs create their own intake invites"
  ON public.va_intake_invites FOR INSERT TO authenticated
  WITH CHECK (va_id = auth.uid());

CREATE POLICY "VAs update their own intake invites"
  ON public.va_intake_invites FOR UPDATE TO authenticated
  USING (va_id = auth.uid());

CREATE POLICY "service_role full access intake invites"
  ON public.va_intake_invites FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_va_intake_invites_updated_at
  BEFORE UPDATE ON public.va_intake_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
