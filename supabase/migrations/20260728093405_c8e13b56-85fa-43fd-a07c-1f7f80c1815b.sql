CREATE OR REPLACE FUNCTION public.create_invite(p_role app_role, p_target_link jsonb DEFAULT '{}'::jsonb, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_name text DEFAULT NULL::text, p_channel text DEFAULT 'sms'::text)
 RETURNS invites
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_row public.invites;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  IF NOT (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_elevated_user(auth.uid())
  ) THEN
    RAISE EXCEPTION 'not authorized to create invites';
  END IF;

  IF p_role::text NOT IN ('wholesaler','ambassador','store','customer','va','driver','biker') THEN
    RAISE EXCEPTION 'role % is not invitable', p_role;
  END IF;

  INSERT INTO public.invites (role, target_link, invited_by, channel, sent_to_phone, sent_to_email, sent_name)
  VALUES (p_role, COALESCE(p_target_link,'{}'::jsonb), auth.uid(), COALESCE(p_channel,'sms'), p_phone, p_email, p_name)
  RETURNING * INTO v_row;
  RETURN v_row;
END $function$;

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

  -- Grant role
  INSERT INTO public.user_roles (user_id, role, role_name, created_by)
  VALUES (v_uid, v_invite.role, v_role, v_invite.invited_by)
  ON CONFLICT DO NOTHING;

  -- Record primary role on the profile so role routing works after login
  INSERT INTO public.user_profiles (user_id, primary_role, full_name, phone)
  VALUES (v_uid, v_role, v_invite.sent_name, v_invite.sent_to_phone)
  ON CONFLICT (user_id) DO UPDATE
    SET primary_role = COALESCE(NULLIF(public.user_profiles.primary_role, ''), EXCLUDED.primary_role),
        full_name = COALESCE(public.user_profiles.full_name, EXCLUDED.full_name),
        phone = COALESCE(public.user_profiles.phone, EXCLUDED.phone);

  v_target := v_invite.target_link;

  -- Role-specific linkage
  IF v_invite.role = 'wholesaler' AND (v_target ? 'wholesaler_profile_id') THEN
    UPDATE public.wholesaler_profiles
       SET user_id = v_uid, status = 'active'
     WHERE id = (v_target->>'wholesaler_profile_id')::uuid;
    v_redirect := '/portals/wholesaler';
  ELSIF v_invite.role = 'wholesaler' THEN
    INSERT INTO public.wholesaler_profiles (user_id, company_name, contact_name, phone, email, status)
    VALUES (v_uid, COALESCE(v_target->>'company_name', v_invite.sent_name, 'New Wholesaler'),
            v_invite.sent_name, v_invite.sent_to_phone, v_invite.sent_to_email, 'active')
    ON CONFLICT DO NOTHING;
    v_redirect := '/portals/wholesaler';
  ELSIF v_invite.role = 'ambassador' THEN
    INSERT INTO public.ambassador_profiles (user_id) VALUES (v_uid) ON CONFLICT DO NOTHING;
    v_redirect := '/ambassador/dashboard';
  ELSIF v_invite.role = 'driver' THEN
    IF NOT EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = v_uid) THEN
      INSERT INTO public.drivers (user_id, full_name, phone, email, status, created_by)
      VALUES (v_uid, v_name, v_invite.sent_to_phone, v_invite.sent_to_email, 'active', v_uid);
    END IF;
    v_redirect := '/portal/driver';
  ELSIF v_invite.role = 'biker' THEN
    IF NOT EXISTS (SELECT 1 FROM public.bikers b WHERE b.user_id = v_uid) THEN
      INSERT INTO public.bikers (user_id, full_name, phone, email, status, created_by)
      VALUES (v_uid, v_name, v_invite.sent_to_phone, v_invite.sent_to_email, 'active', v_uid);
    END IF;
    v_redirect := '/portal/biker';
  ELSIF v_invite.role = 'va' THEN
    INSERT INTO public.va_profiles (user_id, label) VALUES (v_uid, 'VA')
    ON CONFLICT (user_id) DO NOTHING;
    v_redirect := '/va/dashboard';
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
END $function$;