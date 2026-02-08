
-- Phase 5: Production RBAC Hardening
-- ============================================================
-- 1. Create helper functions for production role hierarchy
-- ============================================================

-- Production manager: owner, admin, or production role
CREATE OR REPLACE FUNCTION public.has_production_manager_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('owner', 'admin')
  ) OR EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = _user_id
    AND primary_role = 'production'
  );
$$;

-- Production worker: any user with office access (workers, managers, admins)
CREATE OR REPLACE FUNCTION public.is_production_worker(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.production_office_users
    WHERE user_id = _user_id AND active = true
  ) OR public.has_production_elevated_role(_user_id);
$$;

-- 2. Create access denial audit log table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.production_access_denials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  attempted_resource text NOT NULL,
  attempted_action text NOT NULL,
  user_role text,
  required_role text,
  denied_at timestamptz NOT NULL DEFAULT now(),
  ip_context text
);

ALTER TABLE public.production_access_denials ENABLE ROW LEVEL SECURITY;

-- Only admins can read denial logs
CREATE POLICY "Admins can view access denials"
  ON public.production_access_denials FOR SELECT
  USING (public.has_production_elevated_role(auth.uid()));

-- Anyone can insert (to log their own denials)
CREATE POLICY "Users can log their own denials"
  ON public.production_access_denials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 3. Harden production_batch_costs — finance-gated
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read batch costs" ON public.production_batch_costs;
DROP POLICY IF EXISTS "Authenticated users can insert batch costs" ON public.production_batch_costs;
DROP POLICY IF EXISTS "Authenticated users can update batch costs" ON public.production_batch_costs;
DROP POLICY IF EXISTS "Authenticated users can delete batch costs" ON public.production_batch_costs;

CREATE POLICY "Finance roles can read batch costs"
  ON public.production_batch_costs FOR SELECT
  USING (public.has_finance_access(auth.uid()) OR public.has_production_elevated_role(auth.uid()));

CREATE POLICY "Elevated roles can insert batch costs"
  ON public.production_batch_costs FOR INSERT
  WITH CHECK (public.has_production_elevated_role(auth.uid()));

CREATE POLICY "Elevated roles can update batch costs"
  ON public.production_batch_costs FOR UPDATE
  USING (public.has_production_elevated_role(auth.uid()));

CREATE POLICY "Admins can delete batch costs"
  ON public.production_batch_costs FOR DELETE
  USING (public.is_production_admin(auth.uid()));

-- ============================================================
-- 4. Harden production_overhead_config — admin only
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage overhead config" ON public.production_overhead_config;
DROP POLICY IF EXISTS "Authenticated users can read overhead config" ON public.production_overhead_config;

CREATE POLICY "Finance roles can read overhead config"
  ON public.production_overhead_config FOR SELECT
  USING (public.has_finance_access(auth.uid()) OR public.has_production_elevated_role(auth.uid()));

CREATE POLICY "Admins can manage overhead config"
  ON public.production_overhead_config FOR ALL
  USING (public.is_production_admin(auth.uid()))
  WITH CHECK (public.is_production_admin(auth.uid()));

-- ============================================================
-- 5. Harden production_supplier_lead_times — manager+
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view lead times" ON public.production_supplier_lead_times;
DROP POLICY IF EXISTS "Authenticated users can insert lead times" ON public.production_supplier_lead_times;
DROP POLICY IF EXISTS "Authenticated users can update lead times" ON public.production_supplier_lead_times;
DROP POLICY IF EXISTS "Authenticated users can delete lead times" ON public.production_supplier_lead_times;

CREATE POLICY "Production staff can view lead times"
  ON public.production_supplier_lead_times FOR SELECT
  USING (public.has_production_manager_role(auth.uid()));

CREATE POLICY "Elevated roles can manage lead times"
  ON public.production_supplier_lead_times FOR INSERT
  WITH CHECK (public.has_production_elevated_role(auth.uid()));

CREATE POLICY "Elevated roles can update lead times"
  ON public.production_supplier_lead_times FOR UPDATE
  USING (public.has_production_elevated_role(auth.uid()));

CREATE POLICY "Admins can delete lead times"
  ON public.production_supplier_lead_times FOR DELETE
  USING (public.is_production_admin(auth.uid()));

-- ============================================================
-- 6. Harden production_supply_predictions — manager+
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view predictions" ON public.production_supply_predictions;
DROP POLICY IF EXISTS "Authenticated users can insert predictions" ON public.production_supply_predictions;
DROP POLICY IF EXISTS "Authenticated users can update predictions" ON public.production_supply_predictions;
DROP POLICY IF EXISTS "Authenticated users can delete predictions" ON public.production_supply_predictions;

CREATE POLICY "Production staff can view predictions"
  ON public.production_supply_predictions FOR SELECT
  USING (public.has_production_manager_role(auth.uid()));

CREATE POLICY "System can insert predictions"
  ON public.production_supply_predictions FOR INSERT
  WITH CHECK (public.has_production_elevated_role(auth.uid()));

CREATE POLICY "System can update predictions"
  ON public.production_supply_predictions FOR UPDATE
  USING (public.has_production_elevated_role(auth.uid()));

CREATE POLICY "Admins can delete predictions"
  ON public.production_supply_predictions FOR DELETE
  USING (public.is_production_admin(auth.uid()));

-- ============================================================
-- 7. Harden production_worker_submissions — scoped
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read submissions" ON public.production_worker_submissions;
DROP POLICY IF EXISTS "Managers can update submissions" ON public.production_worker_submissions;

-- Workers see only their own; managers see all for their offices
CREATE POLICY "Users can read own or managed submissions"
  ON public.production_worker_submissions FOR SELECT
  USING (
    auth.uid() = submitted_by
    OR public.has_production_elevated_role(auth.uid())
    OR public.has_production_office_access(auth.uid(), office_id)
  );

-- Only managers/admins can approve/reject
CREATE POLICY "Managers can update submissions"
  ON public.production_worker_submissions FOR UPDATE
  USING (
    public.has_production_elevated_role(auth.uid())
    OR public.has_production_office_access(auth.uid(), office_id)
  );

-- ============================================================
-- 8. Harden production_raw_materials — office-scoped writes
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view raw materials" ON public.production_raw_materials;
DROP POLICY IF EXISTS "Authenticated users can insert raw materials" ON public.production_raw_materials;
DROP POLICY IF EXISTS "Authenticated users can update raw materials" ON public.production_raw_materials;
DROP POLICY IF EXISTS "Authenticated users can delete raw materials" ON public.production_raw_materials;

CREATE POLICY "Production staff can view raw materials"
  ON public.production_raw_materials FOR SELECT
  USING (
    public.has_production_office_access(auth.uid(), office_id)
    OR public.has_production_elevated_role(auth.uid())
  );

CREATE POLICY "Office staff can insert raw materials"
  ON public.production_raw_materials FOR INSERT
  WITH CHECK (
    public.has_production_office_access(auth.uid(), office_id)
    OR public.has_production_elevated_role(auth.uid())
  );

CREATE POLICY "Office staff can update raw materials"
  ON public.production_raw_materials FOR UPDATE
  USING (
    public.has_production_office_access(auth.uid(), office_id)
    OR public.has_production_elevated_role(auth.uid())
  );

CREATE POLICY "Admins can delete raw materials"
  ON public.production_raw_materials FOR DELETE
  USING (public.is_production_admin(auth.uid()));
