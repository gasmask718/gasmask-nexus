
-- 1. Office managers count as office members
CREATE OR REPLACE FUNCTION public.production_office_member(p_user uuid, p_office uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT public.production_core_staff(p_user)
      OR EXISTS (SELECT 1 FROM public.production_office_users u
                 WHERE u.user_id = p_user AND u.office_id = p_office AND u.active IS NOT FALSE)
      OR EXISTS (SELECT 1 FROM public.production_office_managers m
                 WHERE m.user_id = p_user AND m.office_id = p_office)
$function$;

-- 2. Tools / equipment: scope to the office, writes to core staff
DROP POLICY IF EXISTS "Authenticated users can view office tools" ON public.production_office_tools;
DROP POLICY IF EXISTS "Managers can manage office tools" ON public.production_office_tools;
CREATE POLICY "office members can view their office tools" ON public.production_office_tools
  FOR SELECT TO authenticated USING (public.production_office_member(auth.uid(), office_id));
CREATE POLICY "core staff manage office tools" ON public.production_office_tools
  FOR ALL TO authenticated
  USING (public.production_core_staff(auth.uid()))
  WITH CHECK (public.production_core_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view equipment assignments" ON public.production_equipment_assignments;
DROP POLICY IF EXISTS "Authenticated users can insert equipment assignments" ON public.production_equipment_assignments;
DROP POLICY IF EXISTS "Authenticated users can update equipment assignments" ON public.production_equipment_assignments;
CREATE POLICY "office members can view their equipment" ON public.production_equipment_assignments
  FOR SELECT TO authenticated USING (public.production_office_member(auth.uid(), office_id));
CREATE POLICY "core staff manage equipment" ON public.production_equipment_assignments
  FOR ALL TO authenticated
  USING (public.production_core_staff(auth.uid()))
  WITH CHECK (public.production_core_staff(auth.uid()));

DROP POLICY IF EXISTS "Allow authenticated read production_tools_issued" ON public.production_tools_issued;
DROP POLICY IF EXISTS "Allow authenticated insert production_tools_issued" ON public.production_tools_issued;
DROP POLICY IF EXISTS "Allow authenticated update production_tools_issued" ON public.production_tools_issued;
CREATE POLICY "office members can view issued tools" ON public.production_tools_issued
  FOR SELECT TO authenticated
  USING (office_id IS NOT NULL AND public.production_office_member(auth.uid(), office_id));
CREATE POLICY "core staff manage issued tools" ON public.production_tools_issued
  FOR ALL TO authenticated
  USING (public.production_core_staff(auth.uid()))
  WITH CHECK (public.production_core_staff(auth.uid()));

-- 3. Tool / equipment problem reports
CREATE TABLE public.production_tool_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.production_offices(id) ON DELETE CASCADE,
  tool_id uuid REFERENCES public.production_office_tools(id) ON DELETE SET NULL,
  equipment_assignment_id uuid REFERENCES public.production_equipment_assignments(id) ON DELETE SET NULL,
  tool_name text NOT NULL,
  issue_type text NOT NULL DEFAULT 'fault',
  severity text NOT NULL DEFAULT 'normal',
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  reported_by uuid NOT NULL DEFAULT auth.uid(),
  reported_at timestamptz NOT NULL DEFAULT now(),
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT production_tool_issues_type_chk CHECK (issue_type IN ('damage','fault','missing','maintenance','other')),
  CONSTRAINT production_tool_issues_severity_chk CHECK (severity IN ('low','normal','high')),
  CONSTRAINT production_tool_issues_status_chk CHECK (status IN ('open','acknowledged','resolved','closed'))
);
GRANT SELECT, INSERT, UPDATE ON public.production_tool_issues TO authenticated;
GRANT ALL ON public.production_tool_issues TO service_role;
ALTER TABLE public.production_tool_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "office members view their tool issues" ON public.production_tool_issues
  FOR SELECT TO authenticated USING (public.production_office_member(auth.uid(), office_id));
CREATE POLICY "office members report tool issues" ON public.production_tool_issues
  FOR INSERT TO authenticated
  WITH CHECK (public.production_office_member(auth.uid(), office_id) AND reported_by = auth.uid());
CREATE POLICY "reporter updates own open issue" ON public.production_tool_issues
  FOR UPDATE TO authenticated
  USING (reported_by = auth.uid() AND status = 'open' AND public.production_office_member(auth.uid(), office_id))
  WITH CHECK (reported_by = auth.uid() AND public.production_office_member(auth.uid(), office_id));
CREATE POLICY "core staff manage tool issues" ON public.production_tool_issues
  FOR ALL TO authenticated
  USING (public.production_core_staff(auth.uid()))
  WITH CHECK (public.production_core_staff(auth.uid()));
CREATE INDEX idx_prod_tool_issues_office ON public.production_tool_issues(office_id, status);

-- 4. Office returns to HQ
CREATE TABLE public.production_office_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.production_offices(id) ON DELETE CASCADE,
  return_type text NOT NULL,
  item_name text NOT NULL,
  material_type text,
  brand text,
  quantity numeric NOT NULL,
  unit text NOT NULL DEFAULT 'each',
  item_condition text,
  reason text,
  notes text,
  status text NOT NULL DEFAULT 'submitted',
  initiated_by uuid NOT NULL DEFAULT auth.uid(),
  initiated_at timestamptz NOT NULL DEFAULT now(),
  received_quantity numeric,
  received_by uuid,
  received_at timestamptz,
  hq_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT production_office_returns_type_chk CHECK (return_type IN ('unused_material','finished_goods','damaged','tool_equipment','other')),
  CONSTRAINT production_office_returns_status_chk CHECK (status IN ('submitted','received','rejected','cancelled')),
  CONSTRAINT production_office_returns_qty_chk CHECK (quantity > 0)
);
GRANT SELECT, INSERT, UPDATE ON public.production_office_returns TO authenticated;
GRANT ALL ON public.production_office_returns TO service_role;
ALTER TABLE public.production_office_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "office members view their returns" ON public.production_office_returns
  FOR SELECT TO authenticated USING (public.production_office_member(auth.uid(), office_id));
CREATE POLICY "office members create returns" ON public.production_office_returns
  FOR INSERT TO authenticated
  WITH CHECK (public.production_office_member(auth.uid(), office_id) AND initiated_by = auth.uid() AND status = 'submitted');
CREATE POLICY "initiator edits own submitted return" ON public.production_office_returns
  FOR UPDATE TO authenticated
  USING (initiated_by = auth.uid() AND status = 'submitted' AND public.production_office_member(auth.uid(), office_id))
  WITH CHECK (initiated_by = auth.uid() AND status IN ('submitted','cancelled') AND public.production_office_member(auth.uid(), office_id));
CREATE POLICY "core staff manage returns" ON public.production_office_returns
  FOR ALL TO authenticated
  USING (public.production_core_staff(auth.uid()))
  WITH CHECK (public.production_core_staff(auth.uid()));
CREATE INDEX idx_prod_office_returns_office ON public.production_office_returns(office_id, status);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER trg_prod_tool_issues_updated BEFORE UPDATE ON public.production_tool_issues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_prod_office_returns_updated BEFORE UPDATE ON public.production_office_returns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
