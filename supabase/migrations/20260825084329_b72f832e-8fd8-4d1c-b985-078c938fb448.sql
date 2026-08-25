-- 1. Jurisdictions
CREATE TABLE public.sf_attorney_jurisdiction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_id uuid NOT NULL REFERENCES public.surplus_funds_attorneys(id) ON DELETE CASCADE,
  jurisdiction text NOT NULL,
  bar_number text NOT NULL,
  admitted_on date,
  status text DEFAULT 'unverified' CHECK (status IN ('active','inactive','suspended','unverified')),
  discipline_flag boolean DEFAULT false,
  verified_at date,
  verification_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attorney_id, jurisdiction)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sf_attorney_jurisdiction TO authenticated;
GRANT ALL ON public.sf_attorney_jurisdiction TO service_role;
ALTER TABLE public.sf_attorney_jurisdiction ENABLE ROW LEVEL SECURITY;
CREATE POLICY sf_attorney_jurisdiction_select_team ON public.sf_attorney_jurisdiction FOR SELECT TO authenticated
USING (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'employee'::app_role) OR has_role(auth.uid(),'staff'::app_role));
CREATE POLICY sf_attorney_jurisdiction_write_team ON public.sf_attorney_jurisdiction FOR ALL TO authenticated
USING (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'employee'::app_role) OR has_role(auth.uid(),'staff'::app_role))
WITH CHECK (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'employee'::app_role) OR has_role(auth.uid(),'staff'::app_role));

-- 2. Engagement structure
ALTER TABLE public.surplus_funds_attorneys
  ADD COLUMN IF NOT EXISTS engagement_type text NOT NULL DEFAULT 'retained_by_dynasty',
  ADD COLUMN IF NOT EXISTS fee_arrangement text;
ALTER TABLE public.surplus_funds_attorneys
  ADD CONSTRAINT sf_attorneys_engagement_type_check CHECK (engagement_type = 'retained_by_dynasty');
ALTER TABLE public.surplus_funds_attorneys
  ADD CONSTRAINT sf_attorneys_fee_arrangement_check CHECK (fee_arrangement IS NULL OR fee_arrangement IN ('flat_per_filing','hourly','flat_per_matter'));
ALTER TABLE public.surplus_funds_attorneys ALTER COLUMN fee_split DROP DEFAULT;
ALTER TABLE public.surplus_funds_attorney_assignments ALTER COLUMN attorney_fee_percentage DROP DEFAULT;

-- 3. Verification state machine
UPDATE public.surplus_funds_attorneys
   SET application_status = 'prospect'
 WHERE application_status IS NULL
    OR application_status NOT IN ('prospect','bar_verified','conflict_checked','retainer_signed','eligible');
ALTER TABLE public.surplus_funds_attorneys ALTER COLUMN application_status SET DEFAULT 'prospect';
ALTER TABLE public.surplus_funds_attorneys
  ADD CONSTRAINT sf_attorneys_application_status_check CHECK (application_status IN ('prospect','bar_verified','conflict_checked','retainer_signed','eligible'));

-- 4. Contract states -> 22
ALTER TABLE public.surplus_funds_contracts DROP CONSTRAINT IF EXISTS surplus_funds_contracts_state_check;
ALTER TABLE public.surplus_funds_contracts ADD CONSTRAINT surplus_funds_contracts_state_check
  CHECK (state IN ('FL','TX','GA','NJ','NY','IL','MN','PA','KY','WV','DC','AZ','NV','OH','SC','MI','MO','TN','MS','CA','CO','MD'));

-- 5. Retainer artifacts
CREATE TABLE public.sf_retainer_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_id uuid NOT NULL REFERENCES public.surplus_funds_attorneys(id) ON DELETE CASCADE,
  template_version text,
  approved_by text,
  counsel_reviewed_at timestamptz,
  signed_at timestamptz,
  artifact_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sf_retainer_artifacts TO authenticated;
GRANT ALL ON public.sf_retainer_artifacts TO service_role;
ALTER TABLE public.sf_retainer_artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY sf_retainer_artifacts_select_team ON public.sf_retainer_artifacts FOR SELECT TO authenticated
USING (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'employee'::app_role) OR has_role(auth.uid(),'staff'::app_role));
CREATE POLICY sf_retainer_artifacts_write_admin ON public.sf_retainer_artifacts FOR ALL TO authenticated
USING (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role))
WITH CHECK (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role));

-- 6. Recruiting queue
CREATE TABLE public.sf_recruiting_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_name text NOT NULL,
  firm text,
  jurisdiction text NOT NULL CHECK (jurisdiction IN ('FL','TX','GA','NJ','NY','IL','MN','PA','KY','WV','DC','AZ','NV','OH','SC','MI','MO','TN','MS','CA','CO','MD')),
  priority_tier text CHECK (priority_tier IN ('A1','A2','A3')),
  stage text NOT NULL DEFAULT 'identified' CHECK (stage IN ('identified','bar_verified','conflict_checked','recruited','retainer_signed','active')),
  outreach_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_action text,
  phone text,
  email text,
  source text,
  source_ref text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sf_recruiting_queue TO authenticated;
GRANT ALL ON public.sf_recruiting_queue TO service_role;
ALTER TABLE public.sf_recruiting_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY sf_recruiting_queue_select_team ON public.sf_recruiting_queue FOR SELECT TO authenticated
USING (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'employee'::app_role) OR has_role(auth.uid(),'staff'::app_role));
CREATE POLICY sf_recruiting_queue_write_team ON public.sf_recruiting_queue FOR ALL TO authenticated
USING (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'employee'::app_role) OR has_role(auth.uid(),'staff'::app_role))
WITH CHECK (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'employee'::app_role) OR has_role(auth.uid(),'staff'::app_role));
CREATE TRIGGER sf_recruiting_queue_updated_at BEFORE UPDATE ON public.sf_recruiting_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Tighten RLS on contracts / payments / assignments
DROP POLICY IF EXISTS "Authenticated read" ON public.surplus_funds_contracts;
DROP POLICY IF EXISTS "Authenticated write" ON public.surplus_funds_contracts;
DROP POLICY IF EXISTS "Authenticated read" ON public.surplus_funds_payments;
DROP POLICY IF EXISTS "Authenticated write" ON public.surplus_funds_payments;
DROP POLICY IF EXISTS "Authenticated read" ON public.surplus_funds_attorney_assignments;
DROP POLICY IF EXISTS "Authenticated write" ON public.surplus_funds_attorney_assignments;

CREATE POLICY sf_contracts_select_team ON public.surplus_funds_contracts FOR SELECT TO authenticated
USING (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'employee'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_business_role(auth.uid(),'va'::text, business_id));
CREATE POLICY sf_contracts_write_team ON public.surplus_funds_contracts FOR ALL TO authenticated
USING (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'employee'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_business_role(auth.uid(),'va'::text, business_id))
WITH CHECK (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'employee'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_business_role(auth.uid(),'va'::text, business_id));

CREATE POLICY sf_payments_select_team ON public.surplus_funds_payments FOR SELECT TO authenticated
USING (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'employee'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_business_role(auth.uid(),'va'::text, business_id));
CREATE POLICY sf_payments_write_team ON public.surplus_funds_payments FOR ALL TO authenticated
USING (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'employee'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_business_role(auth.uid(),'va'::text, business_id))
WITH CHECK (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'employee'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_business_role(auth.uid(),'va'::text, business_id));

CREATE POLICY sf_assignments_select_team ON public.surplus_funds_attorney_assignments FOR SELECT TO authenticated
USING (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'employee'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_business_role(auth.uid(),'va'::text, business_id));
CREATE POLICY sf_assignments_write_team ON public.surplus_funds_attorney_assignments FOR ALL TO authenticated
USING (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'employee'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_business_role(auth.uid(),'va'::text, business_id))
WITH CHECK (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'employee'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_business_role(auth.uid(),'va'::text, business_id));