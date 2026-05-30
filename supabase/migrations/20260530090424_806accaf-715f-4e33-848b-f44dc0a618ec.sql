-- Feedback / Bug Report submissions from field roles (ambassador/driver/biker/etc.)
CREATE TABLE public.feedback_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_by UUID NOT NULL DEFAULT auth.uid(),
  submitter_role TEXT NOT NULL DEFAULT 'other',
  type TEXT NOT NULL DEFAULT 'bug',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  page_context TEXT,
  severity TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  CONSTRAINT feedback_type_chk CHECK (type IN ('bug','suggestion','not_working','other')),
  CONSTRAINT feedback_status_chk CHECK (status IN ('new','reviewing','in_progress','resolved','wont_fix')),
  CONSTRAINT feedback_severity_chk CHECK (severity IS NULL OR severity IN ('low','medium','high'))
);

CREATE INDEX idx_feedback_submitter ON public.feedback_submissions(submitted_by);
CREATE INDEX idx_feedback_status ON public.feedback_submissions(status);
CREATE INDEX idx_feedback_created ON public.feedback_submissions(created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.feedback_submissions TO authenticated;
GRANT ALL ON public.feedback_submissions TO service_role;

ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;

-- Submitter: insert own
CREATE POLICY "Users insert own feedback"
  ON public.feedback_submissions FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());

-- Submitter: read own
CREATE POLICY "Users read own feedback"
  ON public.feedback_submissions FOR SELECT TO authenticated
  USING (submitted_by = auth.uid());

-- Staff: read all
CREATE POLICY "Staff read all feedback"
  ON public.feedback_submissions FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Staff: update all (status, admin_notes, resolved_at)
CREATE POLICY "Staff update feedback"
  ON public.feedback_submissions FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Auto updated_at
CREATE TRIGGER feedback_submissions_updated_at
  BEFORE UPDATE ON public.feedback_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();