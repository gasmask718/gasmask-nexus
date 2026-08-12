ALTER TABLE public.funding_applications
  ADD COLUMN IF NOT EXISTS lender_id uuid REFERENCES public.funding_lender_database(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lender_product_id uuid REFERENCES public.funding_lender_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submission_method text,
  ADD COLUMN IF NOT EXISTS package_status text,
  ADD COLUMN IF NOT EXISTS created_from_match_id uuid REFERENCES public.funding_client_lender_matches(id) ON DELETE SET NULL;

ALTER TABLE public.funding_applications
  DROP CONSTRAINT IF EXISTS funding_applications_submission_method_check;
ALTER TABLE public.funding_applications
  ADD CONSTRAINT funding_applications_submission_method_check
  CHECK (submission_method IS NULL OR submission_method IN ('api','browser','manual'));

ALTER TABLE public.funding_applications
  DROP CONSTRAINT IF EXISTS funding_applications_package_status_check;
ALTER TABLE public.funding_applications
  ADD CONSTRAINT funding_applications_package_status_check
  CHECK (package_status IS NULL OR package_status IN ('READY','MISSING_INFORMATION','MANUAL_REVIEW','BLOCKED'));

CREATE UNIQUE INDEX IF NOT EXISTS funding_applications_one_open_per_lender
  ON public.funding_applications (client_id, lender_id)
  WHERE lender_id IS NOT NULL
    AND status NOT IN ('Denied','Withdrawn','Funded','Closed','Cancelled');

CREATE INDEX IF NOT EXISTS funding_applications_lender_id_idx
  ON public.funding_applications (lender_id);