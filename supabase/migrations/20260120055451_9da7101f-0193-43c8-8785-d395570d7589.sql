-- ============================================================================
-- OPERATIONAL PORTALS LAYER - SECURITY FOUNDATION (CORRECTED)
-- Creates security definer functions and enforces strict driver/biker isolation
-- ============================================================================

-- 1. Security definer function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_portal_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND role::text = _role
  )
$$;

-- 2. Security definer function to check if user is owner or admin
CREATE OR REPLACE FUNCTION public.is_elevated_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND role::text IN ('owner', 'admin', 'ceo', 'va')
  )
$$;

-- 3. Security definer function to check if driver/biker is assigned to a route
CREATE OR REPLACE FUNCTION public.is_assigned_to_route(_user_id uuid, _route_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.routes
    WHERE id = _route_id
      AND assigned_to = _user_id
  )
$$;

-- 4. Create driver_assignments table to track which drivers are assigned to which routes/stores
CREATE TABLE IF NOT EXISTS public.driver_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  route_id uuid REFERENCES public.routes(id) ON DELETE SET NULL,
  store_id uuid REFERENCES public.store_master(id) ON DELETE SET NULL,
  assigned_date date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  CONSTRAINT at_least_one_assignment CHECK (route_id IS NOT NULL OR store_id IS NOT NULL)
);

-- Enable RLS on driver_assignments
ALTER TABLE public.driver_assignments ENABLE ROW LEVEL SECURITY;

-- Drivers can only view their own assignments
CREATE POLICY "Drivers can view own assignments"
ON public.driver_assignments FOR SELECT
USING (
  auth.uid() = driver_id 
  OR public.is_elevated_user(auth.uid())
);

-- Only elevated users can create/update/delete assignments
CREATE POLICY "Elevated users manage assignments"
ON public.driver_assignments FOR ALL
USING (public.is_elevated_user(auth.uid()))
WITH CHECK (public.is_elevated_user(auth.uid()));

-- 5. Create biker_assignments table for biker-specific assignments
CREATE TABLE IF NOT EXISTS public.biker_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  biker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.store_master(id) ON DELETE SET NULL,
  territory text,
  assigned_date date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  task_type text DEFAULT 'check',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.biker_assignments ENABLE ROW LEVEL SECURITY;

-- Bikers can only view their own assignments
CREATE POLICY "Bikers can view own assignments"
ON public.biker_assignments FOR SELECT
USING (
  auth.uid() = biker_id 
  OR public.is_elevated_user(auth.uid())
);

-- Only elevated users can manage biker assignments
CREATE POLICY "Elevated users manage biker assignments"
ON public.biker_assignments FOR ALL
USING (public.is_elevated_user(auth.uid()))
WITH CHECK (public.is_elevated_user(auth.uid()));

-- 6. Create portal_audit_log to track all portal actions
CREATE TABLE IF NOT EXISTS public.portal_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  portal_type text NOT NULL,
  action_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb DEFAULT '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own audit logs, elevated users can view all
CREATE POLICY "Portal audit log access"
ON public.portal_audit_log FOR SELECT
USING (
  auth.uid() = user_id 
  OR public.is_elevated_user(auth.uid())
);

-- Anyone authenticated can insert their own audit logs
CREATE POLICY "Users insert own audit logs"
ON public.portal_audit_log FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 7. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_driver_assignments_driver_id ON public.driver_assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_assignments_date ON public.driver_assignments(assigned_date);
CREATE INDEX IF NOT EXISTS idx_biker_assignments_biker_id ON public.biker_assignments(biker_id);
CREATE INDEX IF NOT EXISTS idx_biker_assignments_date ON public.biker_assignments(assigned_date);
CREATE INDEX IF NOT EXISTS idx_portal_audit_log_user ON public.portal_audit_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_portal_audit_log_action ON public.portal_audit_log(action_type, created_at);