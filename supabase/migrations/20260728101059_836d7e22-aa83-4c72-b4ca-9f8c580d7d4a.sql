-- 1. URL-safe invite tokens
ALTER TABLE public.invites
  ALTER COLUMN token SET DEFAULT translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/=', '-_');

-- 2/3. Fix accept_invite: driver/biker business_id, ambassador record
CREATE OR REPLACE FUNCTION public.accept_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Resolve owning business for field-worker records
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
    -- Ambassador record is required for store assignments / scoped access
    IF NOT EXISTS (SELECT 1 FROM public.ambassadors a WHERE a.user_id = v_uid) THEN
      LOOP
        v_code := upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 6));
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.ambassadors a WHERE a.tracking_code = v_code);
      END LOOP;
      INSERT INTO public.ambassadors (user_id, name, email, phone, tracking_code, is_active)
      VALUES (v_uid, v_name, v_invite.sent_to_email, v_invite.sent_to_phone, v_code, true);
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