
ALTER TABLE public.wholesaler_profiles
  ADD COLUMN IF NOT EXISTS is_caretaker boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS transfer_pending_email text,
  ADD COLUMN IF NOT EXISTS transferred_at timestamptz,
  ADD COLUMN IF NOT EXISTS transferred_from_user_id uuid;

CREATE TABLE IF NOT EXISTS public.wholesaler_account_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wholesaler_profile_id uuid NOT NULL REFERENCES public.wholesaler_profiles(id) ON DELETE CASCADE,
  invite_id uuid,
  new_email text NOT NULL,
  previous_user_id uuid,
  new_user_id uuid,
  initiated_by uuid,
  status text NOT NULL DEFAULT 'initiated',
  stripe_connect_id_cleared text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

GRANT SELECT ON public.wholesaler_account_transfers TO authenticated;
GRANT ALL ON public.wholesaler_account_transfers TO service_role;
ALTER TABLE public.wholesaler_account_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read wholesaler transfers" ON public.wholesaler_account_transfers;
CREATE POLICY "Admins read wholesaler transfers"
ON public.wholesaler_account_transfers FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));

CREATE INDEX IF NOT EXISTS idx_wat_profile ON public.wholesaler_account_transfers(wholesaler_profile_id);

-- ── Admin action: start a handover ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.transfer_wholesaler_account(
  p_profile_id uuid,
  p_new_email text,
  p_company_name text DEFAULT NULL,
  p_contact_name text DEFAULT NULL,
  p_phone text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_profile public.wholesaler_profiles;
  v_invite public.invites;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role)) THEN
    RAISE EXCEPTION 'not authorized to transfer wholesaler accounts';
  END IF;
  IF p_new_email IS NULL OR p_new_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'valid new_email required';
  END IF;

  SELECT * INTO v_profile FROM public.wholesaler_profiles WHERE id = p_profile_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'wholesaler profile not found'; END IF;

  INSERT INTO public.invites (role, target_link, invited_by, channel, sent_to_email, sent_name)
  VALUES (
    'wholesaler'::app_role,
    jsonb_strip_nulls(jsonb_build_object(
      'wholesaler_profile_id', p_profile_id,
      'transfer', true,
      'company_name', p_company_name,
      'contact_name', p_contact_name,
      'phone', p_phone
    )),
    auth.uid(), 'email', p_new_email, COALESCE(p_contact_name, p_company_name)
  )
  RETURNING * INTO v_invite;

  UPDATE public.wholesaler_profiles
     SET is_caretaker = true,
         transfer_pending_email = p_new_email
   WHERE id = p_profile_id;

  INSERT INTO public.wholesaler_account_transfers
    (wholesaler_profile_id, invite_id, new_email, previous_user_id, initiated_by, status)
  VALUES (p_profile_id, v_invite.id, p_new_email, v_profile.user_id, auth.uid(), 'initiated');

  RETURN jsonb_build_object(
    'success', true,
    'invite_id', v_invite.id,
    'token', v_invite.token,
    'accept_url', '/invite/' || v_invite.token,
    'wholesaler_profile_id', p_profile_id,
    'new_email', p_new_email
  );
END $$;

REVOKE ALL ON FUNCTION public.transfer_wholesaler_account(uuid,text,text,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.transfer_wholesaler_account(uuid,text,text,text,text) TO authenticated;

-- ── Invite acceptance: real handover on the wholesaler branch ────────────────
CREATE OR REPLACE FUNCTION public.accept_invite(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invite public.invites;
  v_uid UUID := auth.uid();
  v_target JSONB;
  v_redirect TEXT;
  v_role TEXT;
  v_name TEXT;
  v_business UUID;
  v_code TEXT;
  v_office UUID;
  v_wp public.wholesaler_profiles;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'auth_required');
  END IF;

  SELECT * INTO v_invite FROM public.invites WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;
  IF v_invite.status = 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_accepted');
  END IF;
  IF v_invite.status = 'revoked' THEN
    RETURN jsonb_build_object('success', false, 'error', 'revoked');
  END IF;
  IF v_invite.expires_at < now() THEN
    UPDATE public.invites SET status='expired' WHERE id = v_invite.id;
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;

  v_role := v_invite.role::text;
  v_name := COALESCE(v_invite.sent_name, 'New ' || v_role);
  v_target := COALESCE(v_invite.target_link, '{}'::jsonb);

  v_business := NULLIF(v_target->>'business_id','')::uuid;
  IF v_business IS NULL THEN
    SELECT id INTO v_business FROM public.businesses WHERE name = 'GasMask' LIMIT 1;
  END IF;

  INSERT INTO public.user_roles (user_id, role, role_name, created_by)
  VALUES (v_uid, v_invite.role, v_role, v_invite.invited_by)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_profiles (user_id, primary_role, full_name, phone)
  VALUES (v_uid, v_role, v_invite.sent_name, v_invite.sent_to_phone)
  ON CONFLICT (user_id) DO UPDATE
    SET primary_role = COALESCE(NULLIF(public.user_profiles.primary_role, ''), EXCLUDED.primary_role),
        full_name = COALESCE(public.user_profiles.full_name, EXCLUDED.full_name),
        phone = COALESCE(public.user_profiles.phone, EXCLUDED.phone);

  IF v_invite.role = 'wholesaler' AND (v_target ? 'wholesaler_profile_id') THEN
    SELECT * INTO v_wp FROM public.wholesaler_profiles
     WHERE id = (v_target->>'wholesaler_profile_id')::uuid FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'wholesaler_profile_missing');
    END IF;

    UPDATE public.wholesaler_profiles
       SET user_id = v_uid,
           status = 'verified',
           email = COALESCE(v_invite.sent_to_email, email),
           company_name = COALESCE(NULLIF(v_target->>'company_name',''), company_name),
           contact_name = COALESCE(NULLIF(v_target->>'contact_name',''), v_invite.sent_name, contact_name),
           phone = COALESCE(NULLIF(v_target->>'phone',''), v_invite.sent_to_phone, phone),
           is_caretaker = false,
           transfer_pending_email = NULL,
           -- Money safety: the caretaker's Stripe Connect account must never
           -- follow the catalog. New owner re-onboards their own bank.
           stripe_connect_id = NULL,
           stripe_payouts_enabled = false,
           stripe_charges_enabled = false,
           stripe_connect_updated_at = now(),
           transferred_at = CASE WHEN v_wp.user_id IS DISTINCT FROM v_uid THEN now() ELSE transferred_at END,
           transferred_from_user_id = CASE WHEN v_wp.user_id IS DISTINCT FROM v_uid THEN v_wp.user_id ELSE transferred_from_user_id END
     WHERE id = v_wp.id;

    -- Drafts stay visible: dd_wholesaler_drafts_safe matches on supplier_id.
    UPDATE public.dd_catalog_drafts
       SET supplier_id = v_wp.id
     WHERE supplier_id IS NULL AND created_by = v_wp.user_id;

    UPDATE public.wholesaler_account_transfers
       SET new_user_id = v_uid,
           status = 'completed',
           completed_at = now(),
           stripe_connect_id_cleared = v_wp.stripe_connect_id
     WHERE invite_id = v_invite.id;

    IF NOT FOUND OR (v_target->>'transfer') IS NULL THEN
      INSERT INTO public.wholesaler_account_transfers
        (wholesaler_profile_id, invite_id, new_email, previous_user_id, new_user_id,
         initiated_by, status, stripe_connect_id_cleared, completed_at, notes)
      SELECT v_wp.id, v_invite.id, COALESCE(v_invite.sent_to_email,''), v_wp.user_id, v_uid,
             v_invite.invited_by, 'completed', v_wp.stripe_connect_id, now(), 'claimed via invite'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.wholesaler_account_transfers t WHERE t.invite_id = v_invite.id
      );
    END IF;

    v_redirect := '/portals/wholesaler';
  ELSIF v_invite.role = 'wholesaler' THEN
    INSERT INTO public.wholesaler_profiles (user_id, company_name, contact_name, phone, email, status)
    VALUES (v_uid, COALESCE(v_target->>'company_name', v_invite.sent_name, 'New Wholesaler'),
            v_invite.sent_name, v_invite.sent_to_phone, v_invite.sent_to_email, 'active')
    ON CONFLICT DO NOTHING;
    v_redirect := '/portals/wholesaler';

  ELSIF v_invite.role = 'ambassador' THEN
    INSERT INTO public.ambassador_profiles (user_id) VALUES (v_uid) ON CONFLICT DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM public.ambassadors a WHERE a.user_id = v_uid) THEN
      LOOP
        v_code := upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 6));
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.ambassadors a WHERE a.tracking_code = v_code);
      END LOOP;
      INSERT INTO public.ambassadors (user_id, name, email, phone_primary, personal_phone, tracking_code, is_active, created_by)
      VALUES (v_uid, v_name, v_invite.sent_to_email, v_invite.sent_to_phone, v_invite.sent_to_phone, v_code, true, v_invite.invited_by);
    END IF;
    v_redirect := '/ambassador/dashboard';

  ELSIF v_invite.role = 'driver' THEN
    IF NOT EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = v_uid) THEN
      INSERT INTO public.drivers (user_id, business_id, full_name, phone, email, status, created_by)
      VALUES (v_uid, v_business, v_name, v_invite.sent_to_phone, v_invite.sent_to_email, 'active', v_uid);
    END IF;
    v_redirect := '/portal/driver';

  ELSIF v_invite.role = 'biker' THEN
    IF NOT EXISTS (SELECT 1 FROM public.bikers b WHERE b.user_id = v_uid) THEN
      INSERT INTO public.bikers (user_id, business_id, full_name, phone, email, status, created_by)
      VALUES (v_uid, v_business, v_name, v_invite.sent_to_phone, v_invite.sent_to_email, 'active', v_uid);
    END IF;
    v_redirect := '/portal/biker';

  ELSIF v_invite.role = 'va' THEN
    INSERT INTO public.va_profiles (user_id, label) VALUES (v_uid, 'VA')
    ON CONFLICT (user_id) DO NOTHING;
    v_redirect := '/va/dashboard';

  ELSIF v_invite.role = 'production' THEN
    v_office := NULLIF(v_target->>'office_id','')::uuid;
    IF v_office IS NOT NULL THEN
      INSERT INTO public.production_office_users (office_id, user_id, role, is_primary, assigned_by)
      VALUES (v_office, v_uid, 'manager', true, v_invite.invited_by)
      ON CONFLICT DO NOTHING;
    END IF;
    v_redirect := '/portals/production';

  ELSIF v_invite.role = 'store' THEN
    v_redirect := '/portals/store';
  ELSIF v_invite.role = 'customer' THEN
    v_redirect := '/account';
  ELSE
    v_redirect := '/';
  END IF;

  UPDATE public.invites
     SET status='accepted', accepted_user_id = v_uid, accepted_at = now()
   WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'success', true,
    'role', v_role,
    'redirect', v_redirect,
    'target_link', v_target
  );
END
$function$;
