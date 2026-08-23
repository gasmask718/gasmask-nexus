-- 1. PostgREST grants (tables had RLS but zero grants — admin screen would 42501)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbound_ring_targets TO authenticated;
GRANT ALL ON public.inbound_ring_targets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbound_policy TO authenticated;
GRANT ALL ON public.inbound_policy TO service_role;

-- 2. VA self-service: a VA manages their OWN 'mobile' ring target for companies
--    they hold an active membership in. Staff policy (ring_staff) unchanged.
CREATE POLICY ring_va_select_own ON public.inbound_ring_targets
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY ring_va_insert_own_mobile ON public.inbound_ring_targets
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND target_type = 'mobile'
    AND EXISTS (
      SELECT 1 FROM public.va_company_memberships m
      WHERE m.user_id = auth.uid()
        AND m.company_id = va_company_id
        AND m.is_active = true
    )
  );

CREATE POLICY ring_va_update_own ON public.inbound_ring_targets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND target_type = 'mobile');

CREATE POLICY ring_va_delete_own ON public.inbound_ring_targets
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 3. AI concierge session state (one row per call, keyed on Twilio CallSid)
CREATE TABLE public.inbound_concierge_sessions (
  call_sid text PRIMARY KEY,
  va_company_id uuid REFERENCES public.va_companies(id),
  from_number text,
  to_number text,
  store_id uuid,
  store_name text,
  contact_name text,
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
GRANT SELECT ON public.inbound_concierge_sessions TO authenticated;
GRANT ALL ON public.inbound_concierge_sessions TO service_role;
ALTER TABLE public.inbound_concierge_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sessions_staff_read ON public.inbound_concierge_sessions
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'staff'::app_role)
  );

-- 4. Structured outcomes the concierge captures (the "human sees it next morning" record)
CREATE TABLE public.inbound_call_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid text NOT NULL,
  va_company_id uuid REFERENCES public.va_companies(id),
  store_id uuid,
  kind text NOT NULL, -- message | callback_request | reorder_intent | address_capture | note
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_inbound_outcomes_created ON public.inbound_call_outcomes (created_at DESC);
CREATE INDEX idx_inbound_outcomes_company ON public.inbound_call_outcomes (va_company_id, created_at DESC);
GRANT SELECT ON public.inbound_call_outcomes TO authenticated;
GRANT ALL ON public.inbound_call_outcomes TO service_role;
ALTER TABLE public.inbound_call_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY outcomes_staff_read ON public.inbound_call_outcomes
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'staff'::app_role)
  );