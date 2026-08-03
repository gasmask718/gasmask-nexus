-- 1. Admin-only internal notes (separate table so submitters can never read them)
CREATE TABLE public.idea_internal_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  idea_id uuid NOT NULL REFERENCES public.idea_submissions(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  author_name text,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_idea_internal_notes_idea ON public.idea_internal_notes(idea_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.idea_internal_notes TO authenticated;
GRANT ALL ON public.idea_internal_notes TO service_role;

ALTER TABLE public.idea_internal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "idea_internal_notes_admin_only"
ON public.idea_internal_notes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER trg_idea_internal_notes_updated_at
BEFORE UPDATE ON public.idea_internal_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Submitters may delete their own submission
CREATE POLICY "idea_delete_own"
ON public.idea_submissions
FOR DELETE
TO authenticated
USING (submitted_by = auth.uid());

-- 3. Block submitters from self-triaging their own submission
CREATE OR REPLACE FUNCTION public.guard_idea_triage_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'owner'::app_role) THEN
    RETURN NEW;
  END IF;

  NEW.status         := OLD.status;
  NEW.priority       := OLD.priority;
  NEW.assigned_to    := OLD.assigned_to;
  NEW.resolution_note:= OLD.resolution_note;
  NEW.resolved_at    := OLD.resolved_at;
  NEW.submitted_by   := OLD.submitted_by;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_idea_triage_fields
BEFORE UPDATE ON public.idea_submissions
FOR EACH ROW EXECUTE FUNCTION public.guard_idea_triage_fields();