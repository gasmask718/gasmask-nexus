
CREATE TABLE IF NOT EXISTS public.bs_outbound_refusals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  caller_function text NOT NULL,
  channel text NOT NULL,
  reason_code text NOT NULL,
  reason_detail text,
  phone text,
  phone_last10 text,
  lead_state text,
  lead_id uuid,
  contact_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS bs_outbound_refusals_created_idx ON public.bs_outbound_refusals (created_at DESC);
CREATE INDEX IF NOT EXISTS bs_outbound_refusals_reason_idx ON public.bs_outbound_refusals (reason_code);

GRANT SELECT ON public.bs_outbound_refusals TO authenticated;
GRANT ALL ON public.bs_outbound_refusals TO service_role;
ALTER TABLE public.bs_outbound_refusals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bs_refusals_admin_read" ON public.bs_outbound_refusals
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE TABLE IF NOT EXISTS public.bs_consent_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  phone text NOT NULL,
  phone_last10 text NOT NULL,
  lead_id uuid,
  consent_source text NOT NULL,
  consent_text text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  evidence_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS bs_consent_artifacts_last10_idx ON public.bs_consent_artifacts (phone_last10);

GRANT SELECT ON public.bs_consent_artifacts TO authenticated;
GRANT ALL ON public.bs_consent_artifacts TO service_role;
ALTER TABLE public.bs_consent_artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bs_consent_admin_read" ON public.bs_consent_artifacts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));
