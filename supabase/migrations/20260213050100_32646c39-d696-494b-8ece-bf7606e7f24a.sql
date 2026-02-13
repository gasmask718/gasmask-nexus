
-- Phase 5B: Human Feedback Reason Codes
CREATE TABLE public.ai_dispatch_feedback_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID REFERENCES public.ai_dispatch_feedback(id) ON DELETE CASCADE,
  reason_code TEXT NOT NULL,
  reason_text TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID NULL
);

ALTER TABLE public.ai_dispatch_feedback_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own feedback reasons"
  ON public.ai_dispatch_feedback_reasons FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can read their own feedback reasons"
  ON public.ai_dispatch_feedback_reasons FOR SELECT
  USING (auth.uid() = created_by);

-- Phase 6: Controlled AI Learning Runs
CREATE TABLE public.ai_learning_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  initiated_by UUID NOT NULL,
  data_window_start TIMESTAMPTZ,
  data_window_end TIMESTAMPTZ,
  proposed_diff JSONB NULL,
  summary JSONB NULL,
  approved BOOLEAN DEFAULT false,
  approved_by UUID NULL,
  approved_at TIMESTAMPTZ NULL,
  rolled_back_at TIMESTAMPTZ NULL,
  rolled_back_by UUID NULL
);

ALTER TABLE public.ai_learning_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read learning runs"
  ON public.ai_learning_runs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert learning runs"
  ON public.ai_learning_runs FOR INSERT
  WITH CHECK (auth.uid() = initiated_by);

CREATE POLICY "Authenticated users can update learning runs"
  ON public.ai_learning_runs FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Validation trigger for status values (instead of CHECK constraint)
CREATE OR REPLACE FUNCTION public.validate_learning_run_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'completed', 'rolled_back') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_learning_run_status
  BEFORE INSERT OR UPDATE ON public.ai_learning_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_learning_run_status();
