
-- ============ 1. Provider registry ============
CREATE TABLE IF NOT EXISTS public.lender_webhook_providers (
  provider            text PRIMARY KEY,
  display_name        text NOT NULL,
  signing_secret_name text NOT NULL,
  tolerance_seconds   integer NOT NULL DEFAULT 300,
  active              boolean NOT NULL DEFAULT true,
  is_qa_fixture       boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lender_webhook_providers TO authenticated;
GRANT ALL ON public.lender_webhook_providers TO service_role;
ALTER TABLE public.lender_webhook_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY lwp_staff_read ON public.lender_webhook_providers
  FOR SELECT TO authenticated USING (public.is_funding_staff(auth.uid()));
CREATE POLICY lwp_service_all ON public.lender_webhook_providers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============ 2. External application reference mapping ============
CREATE TABLE IF NOT EXISTS public.funding_application_external_refs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.funding_applications(id) ON DELETE CASCADE,
  provider       text NOT NULL,
  external_id    text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_id)
);
CREATE INDEX IF NOT EXISTS idx_faer_app ON public.funding_application_external_refs(application_id);
GRANT SELECT ON public.funding_application_external_refs TO authenticated;
GRANT ALL ON public.funding_application_external_refs TO service_role;
ALTER TABLE public.funding_application_external_refs ENABLE ROW LEVEL SECURITY;
CREATE POLICY faer_staff_read ON public.funding_application_external_refs
  FOR SELECT TO authenticated USING (public.is_funding_staff(auth.uid()));
CREATE POLICY faer_service_all ON public.funding_application_external_refs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============ 3. Inbound webhook event log (staff-only; holds raw payloads) ============
CREATE TABLE IF NOT EXISTS public.funding_lender_webhook_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          text NOT NULL,
  event_id          text NOT NULL,
  event_type        text,
  payload_hash      text NOT NULL,
  raw_payload       jsonb NOT NULL,
  signature_valid   boolean NOT NULL DEFAULT false,
  application_id    uuid REFERENCES public.funding_applications(id) ON DELETE SET NULL,
  client_id         uuid,
  normalized_status text,
  outcome           text NOT NULL DEFAULT 'received',
  error_detail      text,
  is_qa_fixture     boolean NOT NULL DEFAULT false,
  received_at       timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz,
  UNIQUE (provider, event_id)
);
CREATE INDEX IF NOT EXISTS idx_flwe_app ON public.funding_lender_webhook_events(application_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_flwe_outcome ON public.funding_lender_webhook_events(outcome, received_at DESC);
GRANT SELECT ON public.funding_lender_webhook_events TO authenticated;
GRANT ALL ON public.funding_lender_webhook_events TO service_role;
ALTER TABLE public.funding_lender_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY flwe_staff_read ON public.funding_lender_webhook_events
  FOR SELECT TO authenticated USING (public.is_funding_staff(auth.uid()));
CREATE POLICY flwe_service_all ON public.funding_lender_webhook_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============ 4. Conflict-aware replay guard ============
CREATE OR REPLACE FUNCTION public.record_application_status(
  _application_id uuid,
  _new_status     text,
  _source         text DEFAULT 'automation',
  _job_id         uuid DEFAULT NULL,
  _event_id       text DEFAULT NULL,
  _message        text DEFAULT NULL,
  _patch          jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev     text;
  v_client   uuid;
  v_dup      boolean := false;
  v_existing record;
  v_conflict boolean := false;
BEGIN
  SELECT status, client_id INTO v_prev, v_client
  FROM public.funding_applications WHERE id = _application_id FOR UPDATE;
  IF v_client IS NULL THEN
    RAISE EXCEPTION 'application % not found', _application_id;
  END IF;

  -- Replay protection: an already-processed lender event is a no-op. If the
  -- replay carries DIFFERENT information it is a conflict, reported explicitly;
  -- the first event always remains authoritative.
  IF _event_id IS NOT NULL THEN
    SELECT h.application_id, h.new_status, COALESCE(h.metadata,'{}'::jsonb) AS metadata
      INTO v_existing
    FROM public.funding_application_status_history h
    WHERE h.event_id = _event_id
    LIMIT 1;

    IF FOUND THEN
      v_conflict :=
        v_existing.application_id IS DISTINCT FROM _application_id
        OR v_existing.new_status IS DISTINCT FROM _new_status
        OR COALESCE(v_existing.metadata->>'approved_amount','')
             IS DISTINCT FROM COALESCE(_patch->>'approved_amount','');

      RETURN jsonb_build_object(
        'applied', false,
        'reason', CASE WHEN v_conflict THEN 'conflicting_event' ELSE 'duplicate_event' END,
        'conflict', v_conflict,
        'previous_status', v_prev,
        'authoritative_status', v_existing.new_status
      );
    END IF;
  END IF;

  PERFORM set_config('app.skip_status_trigger', '1', true);

  UPDATE public.funding_applications SET
    status          = _new_status,
    approved_amount = COALESCE((_patch->>'approved_amount')::numeric, approved_amount),
    decision_date   = COALESCE((_patch->>'decision_date')::date, decision_date),
    application_date= COALESCE((_patch->>'application_date')::date, application_date),
    denial_reason   = COALESCE(_patch->>'denial_reason', denial_reason),
    updated_at      = now()
  WHERE id = _application_id;

  BEGIN
    INSERT INTO public.funding_application_status_history
      (application_id, client_id, previous_status, new_status,
       source, automation_job_id, event_id, message, metadata)
    VALUES (_application_id, v_client, v_prev, _new_status,
            COALESCE(_source,'automation'), _job_id, _event_id,
            COALESCE(_message, format('Status set to %s', _new_status)), _patch);
  EXCEPTION WHEN unique_violation THEN
    v_dup := true;
  END;

  PERFORM set_config('app.skip_status_trigger', '0', true);

  RETURN jsonb_build_object('applied', true, 'duplicate_history', v_dup,
                            'previous_status', v_prev, 'new_status', _new_status);
END;
$$;

REVOKE ALL ON FUNCTION public.record_application_status(uuid,text,text,uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_application_status(uuid,text,text,uuid,text,text,jsonb) TO service_role;

-- ============ 5. QA fixture provider ============
INSERT INTO public.lender_webhook_providers
  (provider, display_name, signing_secret_name, tolerance_seconds, active, is_qa_fixture)
VALUES
  ('qa_fixture_provider', 'QA FIXTURE Provider (NOT A REAL LENDER)',
   'LENDER_WEBHOOK_SIGNING_SECRET', 300, true, true)
ON CONFLICT (provider) DO NOTHING;

CREATE OR REPLACE FUNCTION public.lender_webhook_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_lwp_updated ON public.lender_webhook_providers;
CREATE TRIGGER trg_lwp_updated BEFORE UPDATE ON public.lender_webhook_providers
  FOR EACH ROW EXECUTE FUNCTION public.lender_webhook_touch_updated_at();
