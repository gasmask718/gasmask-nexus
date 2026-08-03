
-- match own client record by email OR linked auth user
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
      AND (c.auth_user_id = auth.uid()
           OR lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  )
$$;

DROP POLICY IF EXISTS "Receptionist client can view own record" ON public.brandaro_receptionist_clients;
CREATE POLICY "Receptionist client can view own record"
ON public.brandaro_receptionist_clients
FOR SELECT TO authenticated
USING (
  auth_user_id = auth.uid()
  OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

DROP POLICY IF EXISTS "Receptionist client can update own record" ON public.brandaro_receptionist_clients;
CREATE POLICY "Receptionist client can update own record"
ON public.brandaro_receptionist_clients
FOR UPDATE TO authenticated
USING (
  auth_user_id = auth.uid()
  OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
)
WITH CHECK (
  auth_user_id = auth.uid()
  OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- staff blanket read must not apply to portal clients
DROP POLICY IF EXISTS brc_auth_read ON public.brandaro_receptionist_clients;
CREATE POLICY brc_auth_read
ON public.brandaro_receptionist_clients
FOR SELECT TO authenticated
USING (NOT public.has_role(auth.uid(), 'receptionist_client'::app_role));

DROP POLICY IF EXISTS brca_auth_read ON public.brandaro_receptionist_calls;
CREATE POLICY brca_auth_read
ON public.brandaro_receptionist_calls
FOR SELECT TO authenticated
USING (NOT public.has_role(auth.uid(), 'receptionist_client'::app_role));
