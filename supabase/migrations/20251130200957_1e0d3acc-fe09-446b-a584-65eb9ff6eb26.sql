-- DYNASTY OS SECURITY PROTOCOL - Phase 1 Part 2: More Sensitive Tables

-- 1. RLS for user_roles (admin-only management)
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;
CREATE POLICY "Only admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Only admins can update roles" ON public.user_roles;
CREATE POLICY "Only admins can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Only admins can delete roles" ON public.user_roles;
CREATE POLICY "Only admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- 2. RLS for audit_logs (admin-only view)
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- 3. RLS for audit_log (admin-only view)
DROP POLICY IF EXISTS "Admins can view audit_log" ON public.audit_log;
CREATE POLICY "Admins can view audit_log"
ON public.audit_log FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- 4. RLS for ai_work_tasks (admin/employee access)
DROP POLICY IF EXISTS "Elevated can view ai_work_tasks" ON public.ai_work_tasks;
CREATE POLICY "Elevated can view ai_work_tasks"
ON public.ai_work_tasks FOR SELECT
TO authenticated
USING (public.is_elevated_user(auth.uid()));

DROP POLICY IF EXISTS "Elevated can manage ai_work_tasks" ON public.ai_work_tasks;
CREATE POLICY "Elevated can manage ai_work_tasks"
ON public.ai_work_tasks FOR ALL
TO authenticated
USING (public.is_elevated_user(auth.uid()))
WITH CHECK (public.is_elevated_user(auth.uid()));

-- 5. Additional security indexes
CREATE INDEX IF NOT EXISTS idx_system_checkpoints_created_by ON public.system_checkpoints(created_by);
CREATE INDEX IF NOT EXISTS idx_system_checkpoints_created_at ON public.system_checkpoints(created_at DESC);