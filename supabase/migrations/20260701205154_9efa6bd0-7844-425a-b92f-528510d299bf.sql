
CREATE TABLE public.dc_compliance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  business_unit_key text REFERENCES public.dc_businesses(business_key) ON DELETE SET NULL,
  lead_id uuid NULL,
  source_table text NULL,
  call_id text NULL,
  actor text NOT NULL DEFAULT 'system',
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dc_compliance_events TO authenticated;
GRANT ALL ON public.dc_compliance_events TO service_role;

ALTER TABLE public.dc_compliance_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY dc_compliance_events_insert
  ON public.dc_compliance_events
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY dc_compliance_events_select
  ON public.dc_compliance_events
  FOR SELECT TO authenticated
  USING (true);

-- Deliberately NO update/delete policies. Immutable ledger.

COMMENT ON TABLE public.dc_compliance_events IS
'Immutable compliance audit ledger. No UPDATE or DELETE permitted by design. INSERT via service_role only (edge functions). SELECT via authenticated users. Do not relax these constraints without legal/compliance review.';

CREATE INDEX idx_dc_compliance_events_type
  ON public.dc_compliance_events(event_type);

CREATE INDEX idx_dc_compliance_events_buk
  ON public.dc_compliance_events(business_unit_key, occurred_at DESC);

CREATE INDEX idx_dc_compliance_events_lead
  ON public.dc_compliance_events(lead_id)
  WHERE lead_id IS NOT NULL;

CREATE INDEX idx_dc_compliance_events_call
  ON public.dc_compliance_events(call_id)
  WHERE call_id IS NOT NULL;
