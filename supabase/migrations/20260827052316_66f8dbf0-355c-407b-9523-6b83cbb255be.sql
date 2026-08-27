
-- BUG: accept_invite wrote to invites.accepted_by, which does not exist.
-- The real column is accepted_user_id. Every acceptance errored at the last step.
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
  v_wp public.wholesaler_profiles;
  v_conflict UUID;
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

  IF v_invite.role = 'wholesaler' AND (v_target ? 'wholesaler_profile_id') THEN
    SELECT id INTO v_conflict FROM public.wholesaler_profiles
     WHERE user_id = v_uid AND id <> (v_target->>'wholesaler_profile_id')::uuid
     LIMIT 1;
    IF v_conflict IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_owns_wholesaler_profile',
        'existing_wholesaler_profile_id', v_conflict);
    END IF;
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
           stripe_connect_id = NULL,
           stripe_payouts_enabled = false,
           stripe_charges_enabled = false,
           stripe_connect_updated_at = now(),
           transferred_at = CASE WHEN v_wp.user_id IS DISTINCT FROM v_uid THEN now() ELSE transferred_at END,
           transferred_from_user_id = CASE WHEN v_wp.user_id IS DISTINCT FROM v_uid THEN v_wp.user_id ELSE transferred_from_user_id END
     WHERE id = v_wp.id;

    UPDATE public.dd_catalog_drafts
       SET supplier_id = v_wp.id
     WHERE supplier_id IS NULL AND created_by = v_wp.user_id;

    UPDATE public.wholesaler_account_transfers
       SET new_user_id = v_uid,
           status = 'completed',
           completed_at = now(),
           stripe_connect_id_cleared = v_wp.stripe_connect_id
     WHERE invite_id = v_invite.id;

    IF NOT EXISTS (SELECT 1 FROM public.wholesaler_account_transfers WHERE invite_id = v_invite.id) THEN
      INSERT INTO public.wholesaler_account_transfers
        (wholesaler_profile_id, invite_id, new_email, previous_user_id, new_user_id,
         initiated_by, status, stripe_connect_id_cleared, completed_at, notes)
      VALUES (v_wp.id, v_invite.id, COALESCE(v_invite.sent_to_email,''), v_wp.user_id, v_uid,
              v_invite.invited_by, 'completed', v_wp.stripe_connect_id, now(), 'claimed via invite');
    END IF;

    v_redirect := '/portal/wholesaler';
  ELSIF v_invite.role = 'wholesaler' THEN
    INSERT INTO public.wholesaler_profiles (user_id, company_name, contact_name, email, phone, status)
    VALUES (v_uid, v_name, v_invite.sent_name, v_invite.sent_to_email, v_invite.sent_to_phone, 'verified')
    ON CONFLICT (user_id) DO NOTHING;
    v_redirect := '/portal/wholesaler';
  ELSE
    v_redirect := public.invite_redirect_for_role(v_role);
  END IF;

  UPDATE public.invites
     SET status = 'accepted', accepted_at = now(), accepted_user_id = v_uid
   WHERE id = v_invite.id;

  RETURN jsonb_build_object('success', true, 'role', v_role, 'redirect', v_redirect);
END;
$function$;
