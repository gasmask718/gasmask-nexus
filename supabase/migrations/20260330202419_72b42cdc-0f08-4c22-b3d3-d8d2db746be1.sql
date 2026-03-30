
-- Add manager hierarchy fields to brandaro_leads_master
ALTER TABLE public.brandaro_leads_master 
  ADD COLUMN IF NOT EXISTS assigned_manager_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS spanish_description TEXT,
  ADD COLUMN IF NOT EXISTS english_description TEXT;

-- Team hierarchy table for manager → VA relationships
CREATE TABLE IF NOT EXISTS public.brandaro_team_hierarchy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES public.profiles(id),
  va_id UUID NOT NULL REFERENCES public.profiles(id),
  team_name TEXT DEFAULT 'Spanish Division',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(manager_id, va_id)
);

ALTER TABLE public.brandaro_team_hierarchy ENABLE ROW LEVEL SECURITY;

-- Managers can see their team
CREATE POLICY "managers_view_team" ON public.brandaro_team_hierarchy
  FOR SELECT TO authenticated
  USING (manager_id = auth.uid() OR va_id = auth.uid());

-- Admins/owners full access
CREATE POLICY "admins_manage_teams" ON public.brandaro_team_hierarchy
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'owner'))
  );

-- Manager lead assignment tracking
CREATE TABLE IF NOT EXISTS public.brandaro_lead_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  assigned_by UUID NOT NULL REFERENCES public.profiles(id),
  assigned_to UUID NOT NULL REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

ALTER TABLE public.brandaro_lead_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assignment_visibility" ON public.brandaro_lead_assignments
  FOR SELECT TO authenticated
  USING (assigned_by = auth.uid() OR assigned_to = auth.uid());

CREATE POLICY "admins_manage_assignments" ON public.brandaro_lead_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'owner'))
  );
