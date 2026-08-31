-- 1. VA company -> business mapping (reusable, no hardcoded people)
ALTER TABLE public.va_companies
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);

COMMENT ON COLUMN public.va_companies.business_id IS
  'Business whose scoped RLS membership (business_members) is provisioned when a VA accepts an invite to this company.';

-- 2. Shared helper: is this store inside a business the caller is a VA for?
CREATE OR REPLACE FUNCTION public.va_can_access_store(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.store_master sm
    WHERE sm.id = _store_id
      AND public.has_role(auth.uid(), 'va'::app_role)
      AND (
        (sm.business_id IS NULL AND public.has_any_business_role(auth.uid(), 'va'))
        OR public.has_business_role(auth.uid(), 'va', sm.business_id)
      )
  )
$$;

-- 3. Atomic VA invite acceptance now also provisions business_members
CREATE OR REPLACE FUNCTION public.accept_va_invite_atomic(p_token text, p_accepting_user_id uuid, p_accepting_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invite RECORD;
  v_business_id uuid;
BEGIN
  IF p_token IS NULL OR p_accepting_user_id IS NULL OR p_accepting_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_arguments');
  END IF;

  SELECT id, email, company_id, role, status, expires_at
    INTO v_invite
    FROM public.va_invites
   WHERE token = p_token
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invite_not_found');
  END IF;

  IF v_invite.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invite_' || v_invite.status);
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE public.va_invites SET status = 'expired' WHERE id = v_invite.id;
    PERFORM public.log_va_invite_event(v_invite.id, 'expired', NULL, NULL, '{}'::jsonb);
    RETURN jsonb_build_object('success', false, 'error', 'invite_expired');
  END IF;

  IF lower(v_invite.email) <> lower(p_accepting_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'email_mismatch');
  END IF;

  INSERT INTO public.user_profiles (user_id, primary_role)
  VALUES (p_accepting_user_id, 'va')
  ON CONFLICT (user_id) DO UPDATE
    SET primary_role = COALESCE(public.user_profiles.primary_role, 'va');

  INSERT INTO public.user_roles (user_id, role)
  SELECT p_accepting_user_id, 'va'::app_role
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = p_accepting_user_id AND role = 'va'::app_role
  );

  INSERT INTO public.va_company_memberships
    (user_id, company_id, role, is_primary, is_active, created_by)
  VALUES
    (p_accepting_user_id, v_invite.company_id, v_invite.role,
     NOT EXISTS (
       SELECT 1 FROM public.va_company_memberships
        WHERE user_id = p_accepting_user_id AND is_primary AND is_active
     ),
     true, p_accepting_user_id)
  ON CONFLICT (user_id, company_id) DO UPDATE
    SET role = EXCLUDED.role,
        is_active = true;

  INSERT INTO public.va_profiles (user_id, label)
  VALUES (p_accepting_user_id, 'VA')
  ON CONFLICT (user_id) DO NOTHING;

  -- Scoped business membership: required by store_master / store_contacts /
  -- store_notes / inventory VA RLS. Driven by va_companies.business_id so any
  -- future company-scoped VA invite provisions the same way.
  SELECT business_id INTO v_business_id
    FROM public.va_companies WHERE id = v_invite.company_id;

  IF v_business_id IS NOT NULL THEN
    INSERT INTO public.business_members (business_id, user_id, role, invited_by)
    VALUES (v_business_id, p_accepting_user_id, 'va', p_accepting_user_id)
    ON CONFLICT (business_id, user_id) DO NOTHING;
  END IF;

  UPDATE public.va_invites
     SET status = 'accepted',
         accepted_by = p_accepting_user_id,
         accepted_at = now()
   WHERE id = v_invite.id;

  PERFORM public.log_va_invite_event(
    v_invite.id, 'accepted', p_accepting_user_id, NULL,
    jsonb_build_object('company_id', v_invite.company_id, 'role', v_invite.role,
                       'business_id', v_business_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'va_user_id', p_accepting_user_id,
    'company_id', v_invite.company_id,
    'business_id', v_business_id,
    'role', v_invite.role
  );
END;
$function$;

-- 4. Call-side stock observations (append-only history, NOT authoritative counts)
CREATE TABLE IF NOT EXISTS public.gasmask_store_call_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id),
  observed_by uuid NOT NULL DEFAULT auth.uid(),
  observed_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'va_call',
  tubes_level text CHECK (tubes_level IN ('full','three_quarter','half','quarter','few','empty')),
  bags_level text CHECK (bags_level IN ('full','three_quarter','half','quarter','few','empty')),
  reorder_needed boolean,
  reorder_quantity integer CHECK (reorder_quantity IS NULL OR reorder_quantity >= 0),
  call_status text CHECK (call_status IN ('needs_reorder','not_yet','no_answer','call_back')),
  callback_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gm_call_obs_store ON public.gasmask_store_call_observations (store_id, observed_at DESC);

GRANT SELECT, INSERT ON public.gasmask_store_call_observations TO authenticated;
GRANT ALL ON public.gasmask_store_call_observations TO service_role;
ALTER TABLE public.gasmask_store_call_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY gm_call_obs_elevated_all ON public.gasmask_store_call_observations
  FOR ALL TO authenticated
  USING (public.is_elevated_user(auth.uid()))
  WITH CHECK (public.is_elevated_user(auth.uid()));

CREATE POLICY gm_call_obs_staff_select ON public.gasmask_store_call_observations
  FOR SELECT TO authenticated
  USING (
    (public.is_internal_staff(auth.uid()) AND NOT public.has_role(auth.uid(), 'va'::app_role))
    OR public.va_can_access_store(store_id)
  );

CREATE POLICY gm_call_obs_staff_insert ON public.gasmask_store_call_observations
  FOR INSERT TO authenticated
  WITH CHECK (
    observed_by = auth.uid()
    AND (
      (public.is_internal_staff(auth.uid()) AND NOT public.has_role(auth.uid(), 'va'::app_role))
      OR public.va_can_access_store(store_id)
    )
  );

-- 5. store_tube_inventory — remove blanket authenticated read/write/delete
DROP POLICY IF EXISTS "Anyone can view tube inventory" ON public.store_tube_inventory;
DROP POLICY IF EXISTS "Authenticated users can delete tube inventory" ON public.store_tube_inventory;
DROP POLICY IF EXISTS "Authenticated users can insert tube inventory" ON public.store_tube_inventory;
DROP POLICY IF EXISTS "Authenticated users can update tube inventory" ON public.store_tube_inventory;

-- simulation guards were permissive (i.e. they GRANTED broad access); make them restrictive
DROP POLICY IF EXISTS store_tube_inventory_simulation_select ON public.store_tube_inventory;
DROP POLICY IF EXISTS store_tube_inventory_simulation_insert ON public.store_tube_inventory;
DROP POLICY IF EXISTS store_tube_inventory_simulation_update ON public.store_tube_inventory;

CREATE POLICY store_tube_inventory_simulation_select ON public.store_tube_inventory
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (is_simulation = public.is_simulation_mode());
CREATE POLICY store_tube_inventory_simulation_write ON public.store_tube_inventory
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (is_simulation = public.is_simulation_mode());
CREATE POLICY store_tube_inventory_simulation_update ON public.store_tube_inventory
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (is_simulation = public.is_simulation_mode())
  WITH CHECK (is_simulation = public.is_simulation_mode());

CREATE POLICY store_tube_inventory_staff_select ON public.store_tube_inventory
  FOR SELECT TO authenticated
  USING (
    public.is_elevated_user(auth.uid())
    OR (public.is_internal_staff(auth.uid()) AND NOT public.has_role(auth.uid(), 'va'::app_role))
    OR public.va_can_access_store(store_id)
  );

CREATE POLICY store_tube_inventory_staff_insert ON public.store_tube_inventory
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_elevated_user(auth.uid())
    OR (public.is_internal_staff(auth.uid()) AND NOT public.has_role(auth.uid(), 'va'::app_role))
    OR public.va_can_access_store(store_id)
  );

CREATE POLICY store_tube_inventory_staff_update ON public.store_tube_inventory
  FOR UPDATE TO authenticated
  USING (
    public.is_elevated_user(auth.uid())
    OR (public.is_internal_staff(auth.uid()) AND NOT public.has_role(auth.uid(), 'va'::app_role))
    OR public.va_can_access_store(store_id)
  )
  WITH CHECK (
    public.is_elevated_user(auth.uid())
    OR (public.is_internal_staff(auth.uid()) AND NOT public.has_role(auth.uid(), 'va'::app_role))
    OR public.va_can_access_store(store_id)
  );

-- deletes: admin/owner only (VAs, ambassadors, customers can never wipe inventory)
CREATE POLICY store_tube_inventory_admin_delete ON public.store_tube_inventory
  FOR DELETE TO authenticated
  USING (public.is_elevated_user(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

REVOKE ALL ON public.store_tube_inventory FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_tube_inventory TO authenticated;
GRANT ALL ON public.store_tube_inventory TO service_role;

-- 6. store_contacts / store_notes — business-scope VA reads & writes
DROP POLICY IF EXISTS store_contacts_staff_select ON public.store_contacts;
DROP POLICY IF EXISTS store_contacts_staff_update ON public.store_contacts;
DROP POLICY IF EXISTS store_contacts_staff_insert ON public.store_contacts;

CREATE POLICY store_contacts_staff_select ON public.store_contacts
  FOR SELECT TO authenticated
  USING (
    (is_simulation = public.is_simulation_mode())
    AND (
      public.is_elevated_user(auth.uid())
      OR (public.is_internal_staff(auth.uid()) AND NOT public.has_role(auth.uid(), 'va'::app_role))
      OR public.va_can_access_store(store_id)
    )
  );

CREATE POLICY store_contacts_staff_update ON public.store_contacts
  FOR UPDATE TO authenticated
  USING (
    (is_simulation = public.is_simulation_mode())
    AND (
      public.is_elevated_user(auth.uid())
      OR (public.is_internal_staff(auth.uid()) AND NOT public.has_role(auth.uid(), 'va'::app_role))
      OR public.va_can_access_store(store_id)
    )
  )
  WITH CHECK (
    (is_simulation = public.is_simulation_mode())
    AND (
      public.is_elevated_user(auth.uid())
      OR (public.is_internal_staff(auth.uid()) AND NOT public.has_role(auth.uid(), 'va'::app_role))
      OR public.va_can_access_store(store_id)
    )
  );

CREATE POLICY store_contacts_staff_insert ON public.store_contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    (is_simulation = public.is_simulation_mode())
    AND (
      public.is_elevated_user(auth.uid())
      OR (public.is_internal_staff(auth.uid()) AND NOT public.has_role(auth.uid(), 'va'::app_role))
      OR public.va_can_access_store(store_id)
    )
  );

DROP POLICY IF EXISTS store_notes_staff_select ON public.store_notes;
DROP POLICY IF EXISTS store_notes_staff_insert ON public.store_notes;

CREATE POLICY store_notes_staff_select ON public.store_notes
  FOR SELECT TO authenticated
  USING (
    public.is_elevated_user(auth.uid())
    OR (public.is_internal_staff(auth.uid()) AND NOT public.has_role(auth.uid(), 'va'::app_role))
    OR public.va_can_access_store(store_id)
  );

CREATE POLICY store_notes_staff_insert ON public.store_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_elevated_user(auth.uid())
    OR (public.is_internal_staff(auth.uid()) AND NOT public.has_role(auth.uid(), 'va'::app_role))
    OR public.va_can_access_store(store_id)
  );

REVOKE ALL ON public.store_contacts FROM PUBLIC, anon;
REVOKE ALL ON public.store_notes FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_notes TO authenticated;
GRANT ALL ON public.store_contacts, public.store_notes TO service_role;

-- 7. v_store_who_to_contact — stop leaking owner names + phones to anon,
--    and make it honour the underlying RLS above.
ALTER VIEW public.v_store_who_to_contact SET (security_invoker = on);
REVOKE ALL ON public.v_store_who_to_contact FROM PUBLIC, anon;
GRANT SELECT ON public.v_store_who_to_contact TO authenticated;
GRANT SELECT ON public.v_store_who_to_contact TO service_role;

-- 8. v_va_caller_ids — expose the phone number id the VA session needs
DROP VIEW IF EXISTS public.v_va_caller_ids;
CREATE VIEW public.v_va_caller_ids AS
  SELECT c.id AS company_id,
     c.name AS company,
     c.slug,
     c.brand_color,
     c.calls_for,
     p.id AS dc_number_id,
     p.phone_number,
     p.friendly_name,
     p.number_type,
     p.is_ai_number,
     p.is_default_caller_id,
     p.status,
     CASE
       WHEN p.is_ai_number THEN 'AI agent line — a human calling from this may confuse the callee'::text
       ELSE 'human voice line'::text
     END AS use_note
  FROM (va_companies c
    LEFT JOIN dc_phone_numbers p ON (((p.va_company_id = c.id) AND (p.status = 'active'::text))))
  WHERE c.is_active;

GRANT SELECT ON public.v_va_caller_ids TO authenticated;
GRANT SELECT ON public.v_va_caller_ids TO service_role;