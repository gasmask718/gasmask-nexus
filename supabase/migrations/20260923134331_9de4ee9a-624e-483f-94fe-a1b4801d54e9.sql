DO $$
DECLARE v_amb uuid; v_token text; v_invite uuid; v_admin uuid := '6019a316-2d95-4662-997c-c47bd0b37697';
BEGIN
  IF EXISTS (SELECT 1 FROM public.ambassadors WHERE lower(email)='naeemamirgraham@gmail.com') THEN
    RAISE NOTICE 'exists'; RETURN;
  END IF;

  INSERT INTO public.ambassadors (tracking_code, name, email, personal_phone, is_active, is_simulation, state, city)
  VALUES ('AMB-NAEEM', 'Naeem Graham', 'Naeemamirgraham@gmail.com', '347-992-4808', true, false, 'NY', 'New York')
  RETURNING id INTO v_amb;

  INSERT INTO public.ambassador_territory_coverage (ambassador_id, region_type, region_value, is_primary)
  VALUES (v_amb,'city','Harlem, NY',true),
         (v_amb,'city','Washington Heights, NY',false),
         (v_amb,'city','Manhattan, NY',false);

  v_token := encode(extensions.gen_random_bytes(32),'hex');
  INSERT INTO public.ambassador_invites (invite_token, token_hash, email, phone, target_ambassador_id, expires_at, invited_by_user_id)
  VALUES (v_token, encode(extensions.digest(v_token,'sha256'),'hex'),
          'Naeemamirgraham@gmail.com','+13479924808', v_amb, now() + interval '14 days', v_admin)
  RETURNING id INTO v_invite;

  INSERT INTO public.ambassador_invite_events (invite_id, event_type, actor_user_id, metadata)
  VALUES (v_invite,'created', v_admin, jsonb_build_object('target_ambassador_id', v_amb, 'source','admin onboarding'));
END $$;