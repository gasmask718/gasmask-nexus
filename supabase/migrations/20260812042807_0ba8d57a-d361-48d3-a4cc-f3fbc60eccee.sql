-- 1) QA fixture marker on clients ------------------------------------------
ALTER TABLE public.funding_clients
  ADD COLUMN IF NOT EXISTS is_qa_fixture boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_funding_clients_qa
  ON public.funding_clients (is_qa_fixture) WHERE is_qa_fixture;

-- 2) QA / production isolation on applications -------------------------------
CREATE OR REPLACE FUNCTION public.funding_application_qa_isolation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lender_qa boolean;
  v_client_qa boolean;
BEGIN
  IF NEW.lender_id IS NULL THEN RETURN NEW; END IF;

  SELECT is_qa_fixture INTO v_lender_qa
  FROM public.funding_lender_database WHERE id = NEW.lender_id;
  SELECT is_qa_fixture INTO v_client_qa
  FROM public.funding_clients WHERE id = NEW.client_id;

  IF COALESCE(v_lender_qa,false) <> COALESCE(v_client_qa,false) THEN
    RAISE EXCEPTION
      'QA isolation violation: lender qa=% cannot be applied to client qa=%',
      COALESCE(v_lender_qa,false), COALESCE(v_client_qa,false);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_funding_application_qa_isolation ON public.funding_applications;
CREATE TRIGGER trg_funding_application_qa_isolation
  BEFORE INSERT OR UPDATE OF lender_id, client_id ON public.funding_applications
  FOR EACH ROW EXECUTE FUNCTION public.funding_application_qa_isolation();

-- 3) Guaranteed status history ----------------------------------------------
CREATE OR REPLACE FUNCTION public.funding_application_status_history_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The atomic RPC writes its own (richer) history row inside the same txn.
  IF COALESCE(current_setting('app.skip_status_trigger', true), '') = '1' THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.funding_application_status_history
      (application_id, client_id, previous_status, new_status, source, message)
    VALUES (NEW.id, NEW.client_id, NULL, NEW.status, 'system',
            'Application created');
    RETURN NULL;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.funding_application_status_history
      (application_id, client_id, previous_status, new_status, source, message)
    VALUES (NEW.id, NEW.client_id, OLD.status, NEW.status, 'system',
            format('Status changed from %s to %s', COALESCE(OLD.status,'(none)'), NEW.status));
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_funding_application_status_history ON public.funding_applications;
CREATE TRIGGER trg_funding_application_status_history
  AFTER INSERT OR UPDATE OF status ON public.funding_applications
  FOR EACH ROW EXECUTE FUNCTION public.funding_application_status_history_trg();

-- 4) Atomic status transition used by the automation API ---------------------
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
  v_prev   text;
  v_client uuid;
  v_dup    boolean := false;
BEGIN
  SELECT status, client_id INTO v_prev, v_client
  FROM public.funding_applications WHERE id = _application_id FOR UPDATE;
  IF v_client IS NULL THEN
    RAISE EXCEPTION 'application % not found', _application_id;
  END IF;

  -- Replay protection: an already-processed lender event is a no-op.
  IF _event_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.funding_application_status_history WHERE event_id = _event_id
  ) THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'duplicate_event',
                              'previous_status', v_prev);
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