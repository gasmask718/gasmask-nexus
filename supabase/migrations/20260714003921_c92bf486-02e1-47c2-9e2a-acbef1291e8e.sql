
CREATE TABLE IF NOT EXISTS public.funding_application_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE,
  legal_business_name text,
  dba text,
  entity_type text,
  formation_state text,
  formation_date date,
  ein text,
  duns_number text,
  naics_code text,
  sic_code text,
  business_address_line1 text,
  business_address_line2 text,
  business_city text,
  business_state text,
  business_zip text,
  business_phone text,
  business_email text,
  business_website text,
  years_in_business numeric,
  annual_revenue numeric,
  monthly_revenue numeric,
  average_bank_balance numeric,
  number_of_employees integer,
  industry text,
  use_of_funds text,
  requested_amount numeric,
  owner_first_name text,
  owner_last_name text,
  owner_title text,
  owner_ssn_last4 text,
  owner_dob date,
  owner_home_address text,
  owner_home_city text,
  owner_home_state text,
  owner_home_zip text,
  owner_phone text,
  owner_email text,
  ownership_percent numeric,
  minority_owned boolean DEFAULT false,
  women_owned boolean DEFAULT false,
  veteran_owned boolean DEFAULT false,
  lgbtq_owned boolean DEFAULT false,
  disabled_owned boolean DEFAULT false,
  bank_name text,
  bank_routing_last4 text,
  bank_account_last4 text,
  business_narrative text,
  mission_statement text,
  extra_fields jsonb DEFAULT '{}'::jsonb,
  last_autofilled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.funding_application_profile TO authenticated;
GRANT ALL ON public.funding_application_profile TO service_role;

ALTER TABLE public.funding_application_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY fap_auth_read ON public.funding_application_profile
  FOR SELECT TO authenticated USING (true);
CREATE POLICY fap_auth_write ON public.funding_application_profile
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY fap_auth_update ON public.funding_application_profile
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY fap_auth_delete ON public.funding_application_profile
  FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_fap_client ON public.funding_application_profile(client_id);

CREATE TRIGGER trg_fap_updated_at
  BEFORE UPDATE ON public.funding_application_profile
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit table
CREATE TABLE IF NOT EXISTS public.funding_autofill_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid,
  business_profile_id uuid,
  funder_type text NOT NULL,
  funder_id uuid,
  funder_name text,
  status text NOT NULL DEFAULT 'draft',
  submission_method text,
  filled_package jsonb,
  narratives jsonb,
  missing_fields text[],
  submitted_at timestamptz,
  submission_confirmation text,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.funding_autofill_runs TO authenticated;
GRANT ALL ON public.funding_autofill_runs TO service_role;

ALTER TABLE public.funding_autofill_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY far_auth_read ON public.funding_autofill_runs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY far_auth_write ON public.funding_autofill_runs
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY far_auth_update ON public.funding_autofill_runs
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_far_client ON public.funding_autofill_runs(client_id);
CREATE INDEX IF NOT EXISTS idx_far_biz ON public.funding_autofill_runs(business_profile_id);

CREATE TRIGGER trg_far_updated_at
  BEFORE UPDATE ON public.funding_autofill_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
