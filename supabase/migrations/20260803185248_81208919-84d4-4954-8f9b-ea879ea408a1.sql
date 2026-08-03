-- ============ 1. FLOWER DEMAND LIST VIEW ============
CREATE OR REPLACE VIEW public.v_flower_demand_list
WITH (security_invoker = true) AS
SELECT
  sm.id                          AS store_id,
  sm.store_name,
  sm.nickname,
  sm.address,
  sm.city,
  sm.state,
  sm.zip,
  sm.borough_id,
  b.name                         AS borough,
  sm.phone                       AS store_phone,
  sm.status                      AS store_status,
  sm.business_id,
  sm.last_visit_at,
  sm.sells_flowers_note          AS flower_note,
  sm.sells_flowers_flagged_at    AS flagged_at,
  sm.sells_flowers_flagged_by    AS flagged_by_id,
  COALESCE(p.name, p.email)      AS flagged_by_name,
  c.name                         AS contact_name,
  c.role                         AS contact_role,
  COALESCE(c.phone, sm.phone)    AS contact_phone
FROM public.store_master sm
LEFT JOIN public.boroughs b ON b.id = sm.borough_id
LEFT JOIN public.profiles p ON p.id = sm.sells_flowers_flagged_by
LEFT JOIN LATERAL (
  SELECT sc.name, sc.role, sc.phone
  FROM public.store_contacts sc
  WHERE sc.store_id = sm.id
  ORDER BY sc.is_primary DESC NULLS LAST, sc.created_at ASC
  LIMIT 1
) c ON TRUE
WHERE sm.sells_flowers IS TRUE;

GRANT SELECT ON public.v_flower_demand_list TO authenticated;

-- ============ 2. IDEA & IMPROVEMENT BOX ============
DO $$ BEGIN
  CREATE TYPE public.idea_status AS ENUM ('new','triaged','planned','in_progress','shipped','declined');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.idea_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by    uuid NOT NULL DEFAULT auth.uid(),
  submitter_name  text,
  submitter_email text,
  submitter_role  text,
  business_id     uuid,
  title           text NOT NULL,
  body            text NOT NULL,
  category        text NOT NULL DEFAULT 'improvement',
  priority        text NOT NULL DEFAULT 'normal',
  status          public.idea_status NOT NULL DEFAULT 'new',
  route_path      text,
  route_label     text,
  store_id        uuid,
  record_type     text,
  record_id       text,
  user_agent      text,
  viewport        text,
  attachments     jsonb NOT NULL DEFAULT '[]'::jsonb,
  assigned_to     uuid,
  resolution_note text,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.idea_submissions TO authenticated;
GRANT ALL ON public.idea_submissions TO service_role;

ALTER TABLE public.idea_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "idea_insert_any_authenticated"
  ON public.idea_submissions FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "idea_select_own"
  ON public.idea_submissions FOR SELECT TO authenticated
  USING (submitted_by = auth.uid());

CREATE POLICY "idea_update_own"
  ON public.idea_submissions FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid())
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "idea_admin_all"
  ON public.idea_submissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

CREATE INDEX IF NOT EXISTS idx_idea_submissions_status_created
  ON public.idea_submissions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_idea_submissions_submitter
  ON public.idea_submissions (submitted_by, created_at DESC);

CREATE TRIGGER trg_idea_submissions_updated_at
  BEFORE UPDATE ON public.idea_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();