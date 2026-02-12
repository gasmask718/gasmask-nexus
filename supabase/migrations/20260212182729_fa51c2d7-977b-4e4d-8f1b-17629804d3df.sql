
-- Create role-check helper (avoids RLS recursion by using SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
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
      AND role = _role
  );
$$;

-- Replace permissive delivery_tasks policies
DROP POLICY IF EXISTS "Authenticated users can view delivery tasks" ON public.delivery_tasks;
DROP POLICY IF EXISTS "Authenticated users can create delivery tasks" ON public.delivery_tasks;
DROP POLICY IF EXISTS "Authenticated users can update delivery tasks" ON public.delivery_tasks;

-- Enforce safe updates for non-managers
CREATE OR REPLACE FUNCTION public.enforce_delivery_tasks_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_manager boolean;
  is_assigned_biker boolean;
BEGIN
  is_manager := (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'owner'::public.app_role)
    OR public.has_role(auth.uid(), 'developer'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
  );

  is_assigned_biker := EXISTS (
    SELECT 1 FROM public.bikers b
    WHERE b.id = NEW.biker_id
      AND b.user_id = auth.uid()
  );

  IF is_manager THEN
    RETURN NEW;
  END IF;

  IF is_assigned_biker THEN
    -- Block changes to assignment/identity/location fields
    IF NEW.invoice_id IS DISTINCT FROM OLD.invoice_id THEN RAISE EXCEPTION 'Not allowed to modify invoice_id'; END IF;
    IF NEW.store_order_id IS DISTINCT FROM OLD.store_order_id THEN RAISE EXCEPTION 'Not allowed to modify store_order_id'; END IF;
    IF NEW.biker_id IS DISTINCT FROM OLD.biker_id THEN RAISE EXCEPTION 'Not allowed to modify biker_id'; END IF;
    IF NEW.assigned_by IS DISTINCT FROM OLD.assigned_by THEN RAISE EXCEPTION 'Not allowed to modify assigned_by'; END IF;
    IF NEW.delivery_address IS DISTINCT FROM OLD.delivery_address THEN RAISE EXCEPTION 'Not allowed to modify delivery_address'; END IF;
    IF NEW.delivery_lat IS DISTINCT FROM OLD.delivery_lat THEN RAISE EXCEPTION 'Not allowed to modify delivery_lat'; END IF;
    IF NEW.delivery_lng IS DISTINCT FROM OLD.delivery_lng THEN RAISE EXCEPTION 'Not allowed to modify delivery_lng'; END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'Not allowed to modify created_at'; END IF;

    -- Allowed: status, picked_up_at, delivered_at, delivery_notes, updated_at
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not authorized to update this delivery task';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_delivery_tasks_update ON public.delivery_tasks;
CREATE TRIGGER trg_enforce_delivery_tasks_update
  BEFORE UPDATE ON public.delivery_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_delivery_tasks_update();

-- Managers (dispatch/admin equivalents) can see all
CREATE POLICY "Managers can view all delivery tasks"
  ON public.delivery_tasks
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'owner'::public.app_role)
    OR public.has_role(auth.uid(), 'developer'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
  );

-- Bikers can see only tasks assigned to them
CREATE POLICY "Bikers can view their delivery tasks"
  ON public.delivery_tasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bikers b
      WHERE b.id = delivery_tasks.biker_id
        AND b.user_id = auth.uid()
    )
  );

-- Managers can create tasks; must set assigned_by correctly
CREATE POLICY "Managers can create delivery tasks"
  ON public.delivery_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'owner'::public.app_role)
      OR public.has_role(auth.uid(), 'developer'::public.app_role)
      OR public.has_role(auth.uid(), 'staff'::public.app_role)
    )
    AND assigned_by = auth.uid()
  );

-- Managers can update any; bikers can update their own (trigger restricts fields)
CREATE POLICY "Managers or assigned biker can update delivery tasks"
  ON public.delivery_tasks
  FOR UPDATE
  TO authenticated
  USING (
    (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'owner'::public.app_role)
      OR public.has_role(auth.uid(), 'developer'::public.app_role)
      OR public.has_role(auth.uid(), 'staff'::public.app_role)
    )
    OR EXISTS (
      SELECT 1 FROM public.bikers b
      WHERE b.id = delivery_tasks.biker_id
        AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'owner'::public.app_role)
      OR public.has_role(auth.uid(), 'developer'::public.app_role)
      OR public.has_role(auth.uid(), 'staff'::public.app_role)
    )
    OR EXISTS (
      SELECT 1 FROM public.bikers b
      WHERE b.id = delivery_tasks.biker_id
        AND b.user_id = auth.uid()
    )
  );
