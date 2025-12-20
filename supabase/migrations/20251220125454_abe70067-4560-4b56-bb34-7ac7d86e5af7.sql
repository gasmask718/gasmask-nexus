-- DYNASTY OS RLS CONSTITUTION - Part 2: Linking Tables & Helper Functions

-- 1. Create user_brand_map linking table for brand isolation
CREATE TABLE IF NOT EXISTS public.user_brand_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, brand_id)
);

-- Enable RLS
ALTER TABLE public.user_brand_map ENABLE ROW LEVEL SECURITY;

-- Policies for user_brand_map
CREATE POLICY "admin_full_access_user_brand_map"
ON public.user_brand_map FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "users_view_own_brands"
ON public.user_brand_map FOR SELECT
USING (user_id = auth.uid());

-- 2. Create user_store_map linking table for store isolation
CREATE TABLE IF NOT EXISTS public.user_store_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES store_master(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, store_id)
);

-- Enable RLS
ALTER TABLE public.user_store_map ENABLE ROW LEVEL SECURITY;

-- Policies for user_store_map
CREATE POLICY "admin_full_access_user_store_map"
ON public.user_store_map FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "users_view_own_stores"
ON public.user_store_map FOR SELECT
USING (user_id = auth.uid());

-- 3. Create is_owner() helper function
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role = 'owner'
  )
$$;

-- 4. Create is_developer() helper function (for denial checks)
CREATE OR REPLACE FUNCTION public.is_developer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role = 'developer'
  )
$$;

-- 5. Create can_access_brand_by_user() helper function for brand isolation
CREATE OR REPLACE FUNCTION public.can_access_brand_by_user(_user_id uuid, _brand_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_admin(_user_id) 
    OR public.is_owner(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_brand_map
      WHERE user_id = _user_id AND brand_id = _brand_id
    )
$$;

-- 6. Create can_access_store() helper function for store isolation
CREATE OR REPLACE FUNCTION public.can_access_store(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_admin(_user_id) 
    OR public.is_owner(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_store_map
      WHERE user_id = _user_id AND store_id = _store_id
    )
$$;

-- 7. Create not_developer() check for deny policies
CREATE OR REPLACE FUNCTION public.not_developer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT public.is_developer(_user_id)
$$;