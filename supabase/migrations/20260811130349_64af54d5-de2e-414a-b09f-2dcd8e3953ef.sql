ALTER TABLE public.funding_lender_database
  ADD COLUMN IF NOT EXISTS is_qa_fixture boolean NOT NULL DEFAULT false;

ALTER TABLE public.lender_automation_config
  ADD COLUMN IF NOT EXISTS is_qa_fixture boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS funding_lender_database_production_idx
  ON public.funding_lender_database (is_active, is_qa_fixture);

-- A QA fixture may never be flagged as authorized for real automated submission.
ALTER TABLE public.lender_automation_config
  DROP CONSTRAINT IF EXISTS lender_automation_config_qa_never_authorized;
ALTER TABLE public.lender_automation_config
  ADD CONSTRAINT lender_automation_config_qa_never_authorized
  CHECK (NOT (is_qa_fixture AND automation_authorized));