CREATE TABLE IF NOT EXISTS public.dynasty_dryrun_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duplicate_group_id integer NOT NULL,
  feedback_text text,
  decision text NOT NULL DEFAULT 'needs_review'
    CHECK (decision IN ('approve','hold','reject','needs_review')),
  reviewer_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dynasty_dryrun_feedback_group
  ON public.dynasty_dryrun_feedback(duplicate_group_id);

ALTER TABLE public.dynasty_dryrun_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_owner_read_dryrun_feedback"
  ON public.dynasty_dryrun_feedback FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

CREATE POLICY "admin_owner_insert_dryrun_feedback"
  ON public.dynasty_dryrun_feedback FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

CREATE POLICY "admin_owner_update_dryrun_feedback"
  ON public.dynasty_dryrun_feedback FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

CREATE TRIGGER trg_dynasty_dryrun_feedback_updated_at
  BEFORE UPDATE ON public.dynasty_dryrun_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();