
-- 1. Extend the existing lender database with the fields the matching/sequencing engine needs
ALTER TABLE public.funding_lender_database
  ADD COLUMN IF NOT EXISTS funding_lane text,
  ADD COLUMN IF NOT EXISTS entity_required text,
  ADD COLUMN IF NOT EXISTS membership_method text,
  ADD COLUMN IF NOT EXISTS min_amount numeric,
  ADD COLUMN IF NOT EXISTS application_url text,
  ADD COLUMN IF NOT EXISTS reports_to text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS no_pg boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS docs_required text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stack_priority integer,
  ADD COLUMN IF NOT EXISTS inquiry_sensitivity text,
  ADD COLUMN IF NOT EXISTS best_paired_with text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS submission_method text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS automation_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_tab text,
  ADD COLUMN IF NOT EXISTS external_ref text,
  ADD COLUMN IF NOT EXISTS import_batch_id uuid;

ALTER TABLE public.funding_lender_database
  DROP CONSTRAINT IF EXISTS funding_lender_database_submission_method_check;
ALTER TABLE public.funding_lender_database
  ADD CONSTRAINT funding_lender_database_submission_method_check
  CHECK (submission_method IN ('api','browser','manual'));

ALTER TABLE public.funding_lender_database
  DROP CONSTRAINT IF EXISTS funding_lender_database_entity_required_check;
ALTER TABLE public.funding_lender_database
  ADD CONSTRAINT funding_lender_database_entity_required_check
  CHECK (entity_required IS NULL OR entity_required IN ('personal','llc','aged_ein','either'));

ALTER TABLE public.funding_lender_database
  DROP CONSTRAINT IF EXISTS funding_lender_database_inquiry_sensitivity_check;
ALTER TABLE public.funding_lender_database
  ADD CONSTRAINT funding_lender_database_inquiry_sensitivity_check
  CHECK (inquiry_sensitivity IS NULL OR inquiry_sensitivity IN ('low','medium','high','extreme'));

ALTER TABLE public.funding_lender_database
  DROP CONSTRAINT IF EXISTS funding_lender_database_category_check;
ALTER TABLE public.funding_lender_database
  ADD CONSTRAINT funding_lender_database_category_check
  CHECK (category IS NULL OR category IN (
    'personal_card','business_card','credit_union','fintech','personal_loan',
    'sba','net30_vendor','auto','shelf_corp','other'));

-- Automation may only ever be enabled on a lender whose route is api/browser
CREATE OR REPLACE FUNCTION public.funding_lender_guard_automation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.submission_method = 'manual' THEN
    NEW.automation_allowed := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_funding_lender_guard_automation ON public.funding_lender_database;
CREATE TRIGGER trg_funding_lender_guard_automation
  BEFORE INSERT OR UPDATE ON public.funding_lender_database
  FOR EACH ROW EXECUTE FUNCTION public.funding_lender_guard_automation();

CREATE INDEX IF NOT EXISTS idx_fld_lane ON public.funding_lender_database(funding_lane);
CREATE INDEX IF NOT EXISTS idx_fld_category ON public.funding_lender_database(category);
CREATE INDEX IF NOT EXISTS idx_fld_stack_priority ON public.funding_lender_database(stack_priority);
CREATE INDEX IF NOT EXISTS idx_fld_active_score ON public.funding_lender_database(is_active, min_credit_score);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fld_external_ref ON public.funding_lender_database(external_ref) WHERE external_ref IS NOT NULL;

-- 2. Import batches (created first so products/lenders can reference it)
CREATE TABLE IF NOT EXISTS public.funding_lender_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  source_tab text,
  target_table text NOT NULL DEFAULT 'funding_lender_database',
  column_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  rows_total integer NOT NULL DEFAULT 0,
  rows_inserted integer NOT NULL DEFAULT 0,
  rows_updated integer NOT NULL DEFAULT 0,
  rows_failed integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'completed',
  imported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT funding_lender_import_batches_status_check
    CHECK (status IN ('pending','completed','failed','reverted'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.funding_lender_import_batches TO authenticated;
GRANT ALL ON public.funding_lender_import_batches TO service_role;
ALTER TABLE public.funding_lender_import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY funding_lender_import_batches_staff_all
  ON public.funding_lender_import_batches FOR ALL TO authenticated
  USING (public.is_funding_staff(auth.uid()))
  WITH CHECK (public.is_funding_staff(auth.uid()));

CREATE POLICY funding_lender_import_batches_service_all
  ON public.funding_lender_import_batches FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_flib_updated_at
  BEFORE UPDATE ON public.funding_lender_import_batches
  FOR EACH ROW EXECUTE FUNCTION public.funding_update_updated_at();

ALTER TABLE public.funding_lender_database
  DROP CONSTRAINT IF EXISTS funding_lender_database_import_batch_fkey;
ALTER TABLE public.funding_lender_database
  ADD CONSTRAINT funding_lender_database_import_batch_fkey
  FOREIGN KEY (import_batch_id) REFERENCES public.funding_lender_import_batches(id) ON DELETE SET NULL;

-- 3. Product catalog: one lender (e.g. a credit union) -> many products
CREATE TABLE IF NOT EXISTS public.funding_lender_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id uuid NOT NULL REFERENCES public.funding_lender_database(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  product_type text,
  funding_lane text,
  min_credit_score integer,
  min_amount numeric,
  max_amount numeric,
  min_revenue numeric,
  min_time_in_business_months integer,
  interest_rate_range text,
  requires_collateral boolean NOT NULL DEFAULT false,
  no_pg boolean NOT NULL DEFAULT false,
  reports_to text[] NOT NULL DEFAULT '{}',
  docs_required text[] NOT NULL DEFAULT '{}',
  stack_priority integer,
  inquiry_sensitivity text,
  application_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  source_tab text,
  external_ref text,
  import_batch_id uuid REFERENCES public.funding_lender_import_batches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT funding_lender_products_inquiry_sensitivity_check
    CHECK (inquiry_sensitivity IS NULL OR inquiry_sensitivity IN ('low','medium','high','extreme'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.funding_lender_products TO authenticated;
GRANT ALL ON public.funding_lender_products TO service_role;
ALTER TABLE public.funding_lender_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY funding_lender_products_staff_all
  ON public.funding_lender_products FOR ALL TO authenticated
  USING (public.is_funding_staff(auth.uid()))
  WITH CHECK (public.is_funding_staff(auth.uid()));

CREATE POLICY funding_lender_products_service_all
  ON public.funding_lender_products FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_flp_updated_at
  BEFORE UPDATE ON public.funding_lender_products
  FOR EACH ROW EXECUTE FUNCTION public.funding_update_updated_at();

CREATE INDEX IF NOT EXISTS idx_flp_lender ON public.funding_lender_products(lender_id);
CREATE INDEX IF NOT EXISTS idx_flp_lane ON public.funding_lender_products(funding_lane);
CREATE INDEX IF NOT EXISTS idx_flp_active_score ON public.funding_lender_products(is_active, min_credit_score);
CREATE UNIQUE INDEX IF NOT EXISTS idx_flp_external_ref ON public.funding_lender_products(external_ref) WHERE external_ref IS NOT NULL;
