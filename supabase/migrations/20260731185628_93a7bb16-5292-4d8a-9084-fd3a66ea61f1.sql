-- 0. Allow 'va' as a business membership role
ALTER TABLE public.business_members DROP CONSTRAINT IF EXISTS business_members_role_check;
ALTER TABLE public.business_members ADD CONSTRAINT business_members_role_check
  CHECK (role = ANY (ARRAY['owner','admin','manager','member','viewer','va']));

-- 1. Backfill VA memberships into business_members (Brandaro)
INSERT INTO public.business_members (business_id, user_id, role)
SELECT '27c67680-dbf0-4002-beda-d85a098866ac'::uuid, m.user_id, 'va'
FROM public.va_company_memberships m
WHERE m.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.user_id = m.user_id
      AND bm.business_id = '27c67680-dbf0-4002-beda-d85a098866ac'::uuid
  );

-- 2. Business-scoped role check (companion to has_role)
CREATE OR REPLACE FUNCTION public.has_business_role(_user_id uuid, _role text, _business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_members bm
    WHERE bm.user_id = _user_id
      AND bm.business_id = _business_id
      AND (bm.role = _role OR bm.role IN ('owner','admin'))
  );
$$;

-- Convenience: does the user hold this role in ANY business?
CREATE OR REPLACE FUNCTION public.has_any_business_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.user_id = _user_id AND bm.role = _role
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_business_role(uuid, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_any_business_role(uuid, text) TO authenticated, service_role;

-- 3. Scoping column on store_master
ALTER TABLE public.store_master
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
CREATE INDEX IF NOT EXISTS idx_store_master_business_id ON public.store_master(business_id);

-- 4. Migrate the 5 unscoped VA policies on store_master
DROP POLICY IF EXISTS "VA update stores v2" ON public.store_master;
DROP POLICY IF EXISTS "VA view all stores v2" ON public.store_master;
DROP POLICY IF EXISTS "va_insert_store_master" ON public.store_master;
DROP POLICY IF EXISTS "va_select_store_master" ON public.store_master;
DROP POLICY IF EXISTS "va_update_store_master" ON public.store_master;

CREATE POLICY "va_select_store_master_scoped"
ON public.store_master FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'va'::app_role)
  AND (
    (business_id IS NULL AND has_any_business_role(auth.uid(), 'va'))
    OR has_business_role(auth.uid(), 'va', business_id)
  )
);

CREATE POLICY "va_update_store_master_scoped"
ON public.store_master FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'va'::app_role)
  AND (
    (business_id IS NULL AND has_any_business_role(auth.uid(), 'va'))
    OR has_business_role(auth.uid(), 'va', business_id)
  )
)
WITH CHECK (
  has_role(auth.uid(), 'va'::app_role)
  AND (
    (business_id IS NULL AND has_any_business_role(auth.uid(), 'va'))
    OR has_business_role(auth.uid(), 'va', business_id)
  )
);

CREATE POLICY "va_insert_store_master_scoped"
ON public.store_master FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'va'::app_role)
  AND (
    (business_id IS NULL AND has_any_business_role(auth.uid(), 'va'))
    OR has_business_role(auth.uid(), 'va', business_id)
  )
);