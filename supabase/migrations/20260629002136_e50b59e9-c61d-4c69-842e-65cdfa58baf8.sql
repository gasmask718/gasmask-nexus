
-- =====================================================
-- T4 Phase 1-3: Per-developer scoping for Brandaro tables
-- =====================================================

-- --- Phase 1: helper functions (SECURITY DEFINER, uuid path) -----------
CREATE OR REPLACE FUNCTION public.dev_can_see_client(_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_brandaro_admin(auth.uid())
    OR EXISTS (
      SELECT 1
        FROM public.brandaro_clients c
       WHERE c.id = _client_id
         AND c.assigned_builder IS NOT NULL
         AND c.assigned_builder = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.dev_can_see_project(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_brandaro_admin(auth.uid())
    OR EXISTS (
      SELECT 1
        FROM public.brandaro_projects p
       WHERE p.id = _project_id
         AND (
           (p.assigned_builder IS NOT NULL AND p.assigned_builder = auth.uid())
           OR public.dev_can_see_client(p.client_id)
         )
    );
$$;

-- --- Phase 2: scope brandaro_clients ----------------------------------
DROP POLICY IF EXISTS "Authenticated users can view brandaro_clients"   ON public.brandaro_clients;
DROP POLICY IF EXISTS "Authenticated users can update brandaro_clients" ON public.brandaro_clients;
DROP POLICY IF EXISTS "Authenticated users can insert brandaro_clients" ON public.brandaro_clients;

CREATE POLICY "Dev or admin views clients"
  ON public.brandaro_clients
  FOR SELECT
  TO authenticated
  USING (public.dev_can_see_client(id));

CREATE POLICY "Dev or admin updates clients"
  ON public.brandaro_clients
  FOR UPDATE
  TO authenticated
  USING (public.dev_can_see_client(id))
  WITH CHECK (public.dev_can_see_client(id));

CREATE POLICY "Admin inserts clients"
  ON public.brandaro_clients
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_brandaro_admin(auth.uid()));

CREATE POLICY "Admin deletes clients"
  ON public.brandaro_clients
  FOR DELETE
  TO authenticated
  USING (public.is_brandaro_admin(auth.uid()));

-- --- Phase 2: scope brandaro_projects ---------------------------------
DROP POLICY IF EXISTS "Authenticated users can manage projects" ON public.brandaro_projects;

CREATE POLICY "Dev or admin views projects"
  ON public.brandaro_projects
  FOR SELECT
  TO authenticated
  USING (public.dev_can_see_project(id));

CREATE POLICY "Dev or admin updates projects"
  ON public.brandaro_projects
  FOR UPDATE
  TO authenticated
  USING (public.dev_can_see_project(id))
  WITH CHECK (public.dev_can_see_project(id));

CREATE POLICY "Admin inserts projects"
  ON public.brandaro_projects
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_brandaro_admin(auth.uid()));

CREATE POLICY "Admin deletes projects"
  ON public.brandaro_projects
  FOR DELETE
  TO authenticated
  USING (public.is_brandaro_admin(auth.uid()));

-- --- Phase 2: scope brandaro_build_jobs -------------------------------
DROP POLICY IF EXISTS "Authenticated users can view build jobs" ON public.brandaro_build_jobs;

CREATE POLICY "Dev or admin views build jobs"
  ON public.brandaro_build_jobs
  FOR SELECT
  TO authenticated
  USING (
    public.is_brandaro_admin(auth.uid())
    OR (project_id IS NOT NULL AND public.dev_can_see_project(project_id))
    OR (client_id  IS NOT NULL AND public.dev_can_see_client(client_id))
  );

CREATE POLICY "Dev or admin updates build jobs"
  ON public.brandaro_build_jobs
  FOR UPDATE
  TO authenticated
  USING (
    public.is_brandaro_admin(auth.uid())
    OR (project_id IS NOT NULL AND public.dev_can_see_project(project_id))
    OR (client_id  IS NOT NULL AND public.dev_can_see_client(client_id))
  )
  WITH CHECK (
    public.is_brandaro_admin(auth.uid())
    OR (project_id IS NOT NULL AND public.dev_can_see_project(project_id))
    OR (client_id  IS NOT NULL AND public.dev_can_see_client(client_id))
  );

CREATE POLICY "Admin inserts build jobs"
  ON public.brandaro_build_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_brandaro_admin(auth.uid()));

CREATE POLICY "Admin deletes build jobs"
  ON public.brandaro_build_jobs
  FOR DELETE
  TO authenticated
  USING (public.is_brandaro_admin(auth.uid()));

-- --- Phase 2: admin-only on proposals + demo_sites (T4b deferred) -----
DROP POLICY IF EXISTS "Authenticated users can manage proposals" ON public.brandaro_proposals;

CREATE POLICY "Admin manages proposals"
  ON public.brandaro_proposals
  FOR ALL
  TO authenticated
  USING (public.is_brandaro_admin(auth.uid()))
  WITH CHECK (public.is_brandaro_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can manage demo sites" ON public.brandaro_demo_sites;

CREATE POLICY "Admin manages demo sites"
  ON public.brandaro_demo_sites
  FOR ALL
  TO authenticated
  USING (public.is_brandaro_admin(auth.uid()))
  WITH CHECK (public.is_brandaro_admin(auth.uid()));

-- --- Phase 3: customer_* tables → admin-only (T4b/T4c deferred) -------
DROP POLICY IF EXISTS "devs view customer sites"   ON public.customer_sites;
DROP POLICY IF EXISTS "devs insert customer sites" ON public.customer_sites;
DROP POLICY IF EXISTS "devs update customer sites" ON public.customer_sites;
DROP POLICY IF EXISTS "devs delete customer sites" ON public.customer_sites;

CREATE POLICY "Admin manages customer sites"
  ON public.customer_sites
  FOR ALL
  TO authenticated
  USING (public.is_brandaro_admin(auth.uid()))
  WITH CHECK (public.is_brandaro_admin(auth.uid()));

DROP POLICY IF EXISTS "devs view intake"   ON public.customer_intake_forms;
DROP POLICY IF EXISTS "devs insert intake" ON public.customer_intake_forms;
DROP POLICY IF EXISTS "devs update intake" ON public.customer_intake_forms;
DROP POLICY IF EXISTS "devs delete intake" ON public.customer_intake_forms;

CREATE POLICY "Admin manages intake forms"
  ON public.customer_intake_forms
  FOR ALL
  TO authenticated
  USING (public.is_brandaro_admin(auth.uid()))
  WITH CHECK (public.is_brandaro_admin(auth.uid()));

DROP POLICY IF EXISTS "devs view change requests"   ON public.customer_change_requests;
DROP POLICY IF EXISTS "devs insert change requests" ON public.customer_change_requests;
DROP POLICY IF EXISTS "devs update change requests" ON public.customer_change_requests;
DROP POLICY IF EXISTS "devs delete change requests" ON public.customer_change_requests;

CREATE POLICY "Admin manages change requests"
  ON public.customer_change_requests
  FOR ALL
  TO authenticated
  USING (public.is_brandaro_admin(auth.uid()))
  WITH CHECK (public.is_brandaro_admin(auth.uid()));
