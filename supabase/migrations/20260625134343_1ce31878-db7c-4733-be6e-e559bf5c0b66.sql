
-- 1. Update handle_new_user to also insert into user_roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'pending');
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
    NEW.email,
    v_role
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Backfill: any existing auth user without a user_roles row gets one from profiles.role
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, COALESCE(p.role, 'pending'::public.app_role)
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
WHERE ur.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Enforce RLS on the flagged table and on the critical tables
ALTER TABLE public.outbound_call_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Tighten communication_logs insert policies
-- Drop overly permissive inserts (auth.uid()=created_by allows ANY auth user; NULL business_id bypass)
DROP POLICY IF EXISTS "Authenticated users can create logs" ON public.communication_logs;
DROP POLICY IF EXISTS "Users can insert logs in their businesses" ON public.communication_logs;

-- Replace with a store/business-scoped + role-gated insert policy
CREATE POLICY "Operators can insert scoped logs"
ON public.communication_logs
FOR INSERT
TO authenticated
WITH CHECK (
  -- creator must be the auth user (or system-generated row left null)
  (created_by IS NULL OR created_by = auth.uid())
  AND (
    -- Admins / owners / CSRs may always insert
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'owner'::public.app_role)
    OR public.has_role(auth.uid(), 'csr'::public.app_role)
    -- Otherwise must be scoped to a business the user belongs to,
    -- or to an ambassador row the user owns
    OR (business_id IS NOT NULL AND public.is_business_member(auth.uid(), business_id))
    OR (ambassador_id IS NOT NULL AND ambassador_id = public.current_ambassador_id())
  )
);

-- 4. Idempotency: add column (was missing) + unique constraint to prevent double-sends
ALTER TABLE public.communication_logs
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS communication_logs_idempotency_key_uniq
  ON public.communication_logs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
