
-- Bridge: auto-activate UT ambassador row when an admin grants the 'ambassador' role.

CREATE OR REPLACE FUNCTION public.bridge_ambassador_role_to_ut(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _email text;
  _name text;
  _ambassador_id uuid;
  _code text;
  _attempts int := 0;
BEGIN
  -- Authorization: admin/owner only, OR self-heal when caller == target user.
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  IF _caller <> _user_id
     AND NOT (public.has_role(_caller, 'admin') OR public.has_role(_caller, 'owner')) THEN
    RAISE EXCEPTION 'insufficient privilege' USING ERRCODE = '42501';
  END IF;

  -- Pull email + name from auth.users + profiles.
  SELECT u.email, COALESCE(p.name, split_part(u.email, '@', 1))
    INTO _email, _name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = _user_id;

  IF _email IS NULL THEN
    RAISE EXCEPTION 'user % not found', _user_id USING ERRCODE = 'P0002';
  END IF;

  -- Try to find an existing row by auth_user_id or email.
  SELECT id INTO _ambassador_id
  FROM public.unforgettable_ambassadors
  WHERE auth_user_id = _user_id
     OR lower(email) = lower(_email)
  ORDER BY (auth_user_id = _user_id) DESC, created_at ASC
  LIMIT 1;

  IF _ambassador_id IS NOT NULL THEN
    UPDATE public.unforgettable_ambassadors
       SET auth_user_id = _user_id,
           status = 'active',
           approved_at = COALESCE(approved_at, now()),
           approved_by = COALESCE(approved_by, _caller)
     WHERE id = _ambassador_id;
    RETURN _ambassador_id;
  END IF;

  -- No row exists: insert a fresh active record with a unique referral_code.
  LOOP
    _attempts := _attempts + 1;
    _code := upper(regexp_replace(substr(encode(gen_random_bytes(6), 'base64'), 1, 8), '[^A-Z0-9]', 'X', 'g'));
    BEGIN
      INSERT INTO public.unforgettable_ambassadors
        (full_name, email, auth_user_id, status, approved_at, approved_by, referral_code)
      VALUES
        (_name, _email, _user_id, 'active', now(), _caller, _code)
      RETURNING id INTO _ambassador_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF _attempts > 5 THEN RAISE; END IF;
    END;
  END LOOP;

  RETURN _ambassador_id;
END;
$$;

REVOKE ALL ON FUNCTION public.bridge_ambassador_role_to_ut(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bridge_ambassador_role_to_ut(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bridge_ambassador_role_to_ut(uuid) TO service_role;

-- One-time activation for tilaplapya.pish@gmail.com (auth user a0fde059-70bd-413d-9275-094726d1f448).
DO $$
DECLARE
  _uid uuid := 'a0fde059-70bd-413d-9275-094726d1f448';
  _email text := 'tilaplapya.pish@gmail.com';
  _name text;
  _amb uuid;
  _code text;
  _attempts int := 0;
BEGIN
  SELECT COALESCE(p.name, 'Tester') INTO _name FROM public.profiles p WHERE p.id = _uid;
  IF _name IS NULL THEN _name := 'Tester'; END IF;

  SELECT id INTO _amb
  FROM public.unforgettable_ambassadors
  WHERE auth_user_id = _uid OR lower(email) = lower(_email)
  ORDER BY (auth_user_id = _uid) DESC, created_at ASC
  LIMIT 1;

  IF _amb IS NOT NULL THEN
    UPDATE public.unforgettable_ambassadors
       SET auth_user_id = _uid, status = 'active',
           approved_at = COALESCE(approved_at, now())
     WHERE id = _amb;
  ELSE
    LOOP
      _attempts := _attempts + 1;
      _code := upper(regexp_replace(substr(encode(gen_random_bytes(6),'base64'),1,8),'[^A-Z0-9]','X','g'));
      BEGIN
        INSERT INTO public.unforgettable_ambassadors
          (full_name, email, auth_user_id, status, approved_at, referral_code)
        VALUES (_name, _email, _uid, 'active', now(), _code);
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF _attempts > 5 THEN RAISE; END IF;
      END;
    END LOOP;
  END IF;

  -- Ensure user_roles has ambassador
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'ambassador')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
