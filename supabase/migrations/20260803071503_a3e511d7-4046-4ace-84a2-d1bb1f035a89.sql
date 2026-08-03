ALTER TABLE public.brandaro_receptionist_clients
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_brc_auth_user_id ON public.brandaro_receptionist_clients(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_brc_email_lower ON public.brandaro_receptionist_clients(lower(email));

-- Owns-this-client check used by RLS (security definer avoids recursion)
CREATE OR REPLACE FUNCTION public.owns_receptionist_client(_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.brandaro_receptionist_clients c
    WHERE c.id = _client_id
      AND c.auth_user_id = auth.uid()
  )
$$;

-- Claim: match the signed-in user's verified email to the email they paid with
CREATE OR REPLACE FUNCTION public.claim_receptionist_client_account()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _client_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT lower(u.email) INTO _email
  FROM auth.users u
  WHERE u.id = _uid AND u.email_confirmed_at IS NOT NULL;

  IF _email IS NULL THEN
    RAISE EXCEPTION 'Email not verified';
  END IF;

  SELECT c.id INTO _client_id
  FROM public.brandaro_receptionist_clients c
  WHERE lower(c.email) = _email
    AND (c.auth_user_id IS NULL OR c.auth_user_id = _uid)
  ORDER BY c.created_at
  LIMIT 1;

  IF _client_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.brandaro_receptionist_clients
     SET auth_user_id = _uid, updated_at = now()
   WHERE id = _client_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'receptionist_client'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN _client_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_receptionist_client_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_receptionist_client(uuid) TO authenticated;

-- Client-scoped read/update of own record
DROP POLICY IF EXISTS "Receptionist client can view own record" ON public.brandaro_receptionist_clients;
CREATE POLICY "Receptionist client can view own record"
ON public.brandaro_receptionist_clients
FOR SELECT TO authenticated
USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Receptionist client can update own record" ON public.brandaro_receptionist_clients;
CREATE POLICY "Receptionist client can update own record"
ON public.brandaro_receptionist_clients
FOR UPDATE TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

-- Client-scoped read of own calls
DROP POLICY IF EXISTS "Receptionist client can view own calls" ON public.brandaro_receptionist_calls;
CREATE POLICY "Receptionist client can view own calls"
ON public.brandaro_receptionist_calls
FOR SELECT TO authenticated
USING (public.owns_receptionist_client(client_id));