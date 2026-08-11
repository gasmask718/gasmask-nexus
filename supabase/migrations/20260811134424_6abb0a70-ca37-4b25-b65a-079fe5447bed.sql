-- 1. client_notes: internal staff only
DROP POLICY IF EXISTS cn_auth ON public.client_notes;
DROP POLICY IF EXISTS cn_service ON public.client_notes;

CREATE POLICY cn_staff_all ON public.client_notes
  FOR ALL TO authenticated
  USING (public.is_funding_staff(auth.uid()))
  WITH CHECK (public.is_funding_staff(auth.uid()));

CREATE POLICY cn_service ON public.client_notes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.client_notes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_notes TO authenticated;
GRANT ALL ON public.client_notes TO service_role;

-- 2. client-visible status updates
CREATE TABLE IF NOT EXISTS public.client_status_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.funding_clients(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  body text,
  action_required boolean NOT NULL DEFAULT false,
  action_label text,
  action_url text,
  application_id uuid,
  read_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_csu_client ON public.client_status_updates(client_id, created_at DESC);

GRANT SELECT, UPDATE ON public.client_status_updates TO authenticated;
GRANT ALL ON public.client_status_updates TO service_role;
ALTER TABLE public.client_status_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY csu_client_read ON public.client_status_updates
  FOR SELECT TO authenticated
  USING (public.is_funding_client_self(client_id, auth.uid()) OR public.is_funding_staff(auth.uid()));

CREATE POLICY csu_client_mark_read ON public.client_status_updates
  FOR UPDATE TO authenticated
  USING (public.is_funding_client_self(client_id, auth.uid()) OR public.is_funding_staff(auth.uid()))
  WITH CHECK (public.is_funding_client_self(client_id, auth.uid()) OR public.is_funding_staff(auth.uid()));

CREATE POLICY csu_staff_write ON public.client_status_updates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_funding_staff(auth.uid()));

CREATE POLICY csu_staff_delete ON public.client_status_updates
  FOR DELETE TO authenticated
  USING (public.is_funding_staff(auth.uid()));

CREATE POLICY csu_service ON public.client_status_updates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_csu_updated_at BEFORE UPDATE ON public.client_status_updates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. application status history (idempotent)
CREATE TABLE IF NOT EXISTS public.funding_application_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.funding_applications(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.funding_clients(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  client_display_status text,
  source text NOT NULL DEFAULT 'system',
  automation_job_id uuid,
  event_id text,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fash_event ON public.funding_application_status_history(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fash_app ON public.funding_application_status_history(application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fash_client ON public.funding_application_status_history(client_id, created_at DESC);

GRANT SELECT ON public.funding_application_status_history TO authenticated;
GRANT ALL ON public.funding_application_status_history TO service_role;
ALTER TABLE public.funding_application_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY fash_read ON public.funding_application_status_history
  FOR SELECT TO authenticated
  USING (public.is_funding_client_self(client_id, auth.uid()) OR public.is_funding_staff(auth.uid()));

CREATE POLICY fash_service ON public.funding_application_status_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. canonical portal account link (identity derived from verified JWT email only)
CREATE OR REPLACE FUNCTION public.claim_funding_portal_account()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text := lower(nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'email',''));
  _client_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT fc.id INTO _client_id
  FROM public.funding_clients fc
  WHERE fc.user_id = _uid OR fc.portal_user_id = _uid::text
  LIMIT 1;

  IF _client_id IS NULL AND _email IS NOT NULL THEN
    SELECT fc.id INTO _client_id
    FROM public.funding_clients fc
    WHERE lower(fc.email) = _email
      AND (fc.portal_user_id IS NULL OR fc.portal_user_id = _uid::text)
    ORDER BY fc.created_at
    LIMIT 1;

    IF _client_id IS NOT NULL THEN
      UPDATE public.funding_clients
      SET portal_user_id = _uid::text,
          user_id = COALESCE(user_id, _uid),
          updated_at = now()
      WHERE id = _client_id;
    END IF;
  END IF;

  RETURN _client_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_funding_portal_account() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_funding_portal_account() TO authenticated;