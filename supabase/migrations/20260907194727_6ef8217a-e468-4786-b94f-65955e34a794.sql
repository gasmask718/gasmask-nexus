-- Stage 3: minimal manager -> team -> agent structure for Dynasty Connect.
-- Company/vertical membership (public.business_members) is deliberately NOT touched:
-- team ownership and business access stay independent.

CREATE TABLE public.sales_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  manager_user_id uuid NOT NULL,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX sales_teams_name_unique ON public.sales_teams (lower(name));
CREATE INDEX idx_sales_teams_manager ON public.sales_teams (manager_user_id);

CREATE TABLE public.sales_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.sales_teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  team_role text NOT NULL DEFAULT 'agent' CHECK (team_role IN ('agent', 'team_lead')),
  is_active boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid,
  removed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX sales_team_members_team_user_unique ON public.sales_team_members (team_id, user_id);
-- an agent belongs to at most one ACTIVE team at a time
CREATE UNIQUE INDEX sales_team_members_one_active_team ON public.sales_team_members (user_id) WHERE is_active;
CREATE INDEX idx_sales_team_members_team ON public.sales_team_members (team_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_team_members TO authenticated;
GRANT ALL ON public.sales_teams TO service_role;
GRANT ALL ON public.sales_team_members TO service_role;

ALTER TABLE public.sales_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_team_members ENABLE ROW LEVEL SECURITY;

-- helper: is the caller the manager of this team?
CREATE OR REPLACE FUNCTION public.is_sales_team_manager(_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sales_teams t
    WHERE t.id = _team_id AND t.manager_user_id = auth.uid()
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_sales_team_manager(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_sales_team_manager(uuid) TO authenticated, service_role;

-- teams
CREATE POLICY "Admins manage sales teams"
  ON public.sales_teams FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers view their team"
  ON public.sales_teams FOR SELECT TO authenticated
  USING (manager_user_id = auth.uid());

CREATE POLICY "Members view their team"
  ON public.sales_teams FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sales_team_members m
    WHERE m.team_id = sales_teams.id AND m.user_id = auth.uid() AND m.is_active
  ));

-- memberships
CREATE POLICY "Admins manage team members"
  ON public.sales_team_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers manage their own team members"
  ON public.sales_team_members FOR ALL TO authenticated
  USING (public.is_sales_team_manager(team_id))
  WITH CHECK (public.is_sales_team_manager(team_id));

CREATE POLICY "Agents view their own membership"
  ON public.sales_team_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_sales_teams_updated_at
  BEFORE UPDATE ON public.sales_teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_sales_team_members_updated_at
  BEFORE UPDATE ON public.sales_team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- read-only roster for the manager screens
CREATE OR REPLACE VIEW public.v_sales_team_roster
WITH (security_invoker = true) AS
SELECT
  t.id                AS team_id,
  t.name              AS team_name,
  t.manager_user_id,
  mp.name             AS manager_name,
  mp.email            AS manager_email,
  t.business_id,
  t.is_active         AS team_active,
  m.id                AS membership_id,
  m.user_id           AS agent_user_id,
  ap.name             AS agent_name,
  ap.email            AS agent_email,
  m.team_role,
  m.is_active         AS membership_active,
  m.assigned_at
FROM public.sales_teams t
LEFT JOIN public.sales_team_members m ON m.team_id = t.id
LEFT JOIN public.profiles mp ON mp.id = t.manager_user_id
LEFT JOIN public.profiles ap ON ap.id = m.user_id;

COMMENT ON VIEW public.v_sales_team_roster IS
  'Stage 3 team roster: sales_teams + sales_team_members + profile names. Read-only; performance numbers come from v_sales_activity / v_sales_agent_rollup.';

GRANT SELECT ON public.v_sales_team_roster TO authenticated;
GRANT ALL ON public.v_sales_team_roster TO service_role;