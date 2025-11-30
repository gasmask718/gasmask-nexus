-- DYNASTY OS SECURITY PROTOCOL - All Functions and Policies

-- 1. Create is_admin function
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role = 'admin'
  )
$$;

-- 2. Create is_elevated_user function
CREATE OR REPLACE FUNCTION public.is_elevated_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('admin', 'employee', 'accountant')
  )
$$;

-- 3. Create can_access_own_or_admin function
CREATE OR REPLACE FUNCTION public.can_access_own_or_admin(_user_id uuid, _owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT _user_id = _owner_id OR public.is_admin(_user_id)
$$;

-- 4. RLS Policies for orders
DROP POLICY IF EXISTS "Users can view orders" ON public.orders;
CREATE POLICY "Users can view orders"
ON public.orders FOR SELECT
TO authenticated
USING (
  public.is_elevated_user(auth.uid()) OR
  created_by = auth.uid() OR
  customer_id = auth.uid() OR
  assigned_to = auth.uid() OR
  driver_id = auth.uid() OR
  biker_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can create orders" ON public.orders;
CREATE POLICY "Users can create orders"
ON public.orders FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Elevated users can update orders" ON public.orders;
CREATE POLICY "Elevated users can update orders"
ON public.orders FOR UPDATE
TO authenticated
USING (public.is_elevated_user(auth.uid()) OR created_by = auth.uid() OR assigned_to = auth.uid());

-- 5. Create system_checkpoints table
CREATE TABLE IF NOT EXISTS public.system_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  diagnostics jsonb,
  notes text,
  version text
);

ALTER TABLE public.system_checkpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage checkpoints" ON public.system_checkpoints;
CREATE POLICY "Admins can manage checkpoints"
ON public.system_checkpoints FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 6. Security indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON public.orders(created_by);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_to ON public.orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON public.orders(order_status);