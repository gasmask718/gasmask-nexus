CREATE OR REPLACE FUNCTION public.grant_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.grant_calc_years_in_business()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.date_incorporated IS NULL THEN
    NEW.years_in_business := NULL;
  ELSE
    NEW.years_in_business := EXTRACT(YEAR FROM age(now(), NEW.date_incorporated::timestamp));
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- TABLE 1: grant_business_profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.grant_business_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  business_name text NOT NULL,
  legal_name text,
  dba_name text,
  entity_type text CHECK (entity_type IS NULL OR entity_type IN ('llc','corp','sole_prop','nonprofit','partnership')),
  business_description text,
  website text,
  logo_url text,
  is_active boolean NOT NULL DEFAULT true,

  ein text,
  state_of_incorporation text,
  date_incorporated date,
  years_in_business numeric,
  naics_primary text,
  naics_secondary text[],
  duns_number text,
  uei_number text,
  sam_registered boolean NOT NULL DEFAULT false,
  sam_expiration_date date,
  state_registration_number text,
  business_licenses text[],

  address_street text,
  address_city text,
  address_state text,
  address_zip text,
  address_county text,
  congressional_district text,
  is_urban boolean,
  is_rural boolean,
  is_opportunity_zone boolean,
  is_hud_zone boolean,

  owner_name text,
  owner_title text,
  owner_email text,
  owner_phone text,
  owner_race text,
  owner_ethnicity text,
  owner_gender text,
  owner_veteran boolean NOT NULL DEFAULT false,
  owner_disabled boolean NOT NULL DEFAULT false,
  owner_percentage numeric,

  cert_mbe boolean NOT NULL DEFAULT false,
  cert_mbe_number text,
  cert_mbe_expiration date,
  cert_wbe boolean NOT NULL DEFAULT false,
  cert_wbe_number text,
  cert_wbe_expiration date,
  cert_sdvob boolean NOT NULL DEFAULT false,
  cert_sdvob_number text,
  cert_sdvob_expiration date,
  cert_8a boolean NOT NULL DEFAULT false,
  cert_8a_number text,
  cert_8a_expiration date,
  cert_hubzone boolean NOT NULL DEFAULT false,
  cert_hubzone_number text,
  cert_hubzone_expiration date,
  cert_veteran boolean NOT NULL DEFAULT false,
  cert_veteran_number text,
  cert_sba_small boolean NOT NULL DEFAULT false,
  cert_dbe boolean NOT NULL DEFAULT false,
  cert_dbe_number text,
  cert_dbe_expiration date,

  annual_revenue_current numeric,
  annual_revenue_prior numeric,
  annual_revenue_two_years_ago numeric,
  net_income_current numeric,
  cash_on_hand numeric,
  outstanding_debt numeric,
  collateral_available boolean,
  collateral_description text,
  credit_score_business integer,
  credit_score_personal integer,

  jobs_to_create integer NOT NULL DEFAULT 0,
  jobs_to_retain integer NOT NULL DEFAULT 0,
  employee_count_ft integer,
  employee_count_pt integer,
  employee_count_contract integer,

  doc_ein_letter boolean NOT NULL DEFAULT false,
  doc_articles_of_incorporation boolean NOT NULL DEFAULT false,
  doc_operating_agreement boolean NOT NULL DEFAULT false,
  doc_business_license boolean NOT NULL DEFAULT false,
  doc_tax_returns_current boolean NOT NULL DEFAULT false,
  doc_tax_returns_prior boolean NOT NULL DEFAULT false,
  doc_bank_statements boolean NOT NULL DEFAULT false,
  doc_financial_statements boolean NOT NULL DEFAULT false,
  doc_business_plan boolean NOT NULL DEFAULT false,
  doc_resumes boolean NOT NULL DEFAULT false,
  doc_certifications boolean NOT NULL DEFAULT false,
  doc_insurance boolean NOT NULL DEFAULT false,
  doc_lease_or_deed boolean NOT NULL DEFAULT false,

  completeness_score integer NOT NULL DEFAULT 0,
  eligible_grant_count integer NOT NULL DEFAULT 0,
  last_eligibility_check_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grant_business_profiles TO authenticated;
GRANT ALL ON public.grant_business_profiles TO service_role;

ALTER TABLE public.grant_business_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY gbp_service_all ON public.grant_business_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY gbp_auth_read ON public.grant_business_profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY gbp_auth_insert ON public.grant_business_profiles
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY gbp_auth_update ON public.grant_business_profiles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_gbp_updated_at
  BEFORE UPDATE ON public.grant_business_profiles
  FOR EACH ROW EXECUTE FUNCTION public.grant_set_updated_at();

CREATE TRIGGER trg_gbp_years
  BEFORE INSERT OR UPDATE OF date_incorporated ON public.grant_business_profiles
  FOR EACH ROW EXECUTE FUNCTION public.grant_calc_years_in_business();

CREATE INDEX IF NOT EXISTS idx_gbp_active ON public.grant_business_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_gbp_naics ON public.grant_business_profiles(naics_primary);

-- ============================================================
-- TABLE 2: grant_requirements
-- ============================================================
CREATE TABLE IF NOT EXISTS public.grant_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_opportunity_id uuid NOT NULL REFERENCES public.grant_opportunities(id) ON DELETE CASCADE,
  requirement_type text NOT NULL CHECK (requirement_type IN (
    'certification','revenue','employees','location','industry',
    'years_in_business','document','other'
  )),
  field_name text NOT NULL,
  operator text NOT NULL CHECK (operator IN (
    'is_true','is_not_null','greater_than','less_than','equals','contains'
  )),
  required_value text,
  is_mandatory boolean NOT NULL DEFAULT true,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grant_requirements TO authenticated;
GRANT ALL ON public.grant_requirements TO service_role;

ALTER TABLE public.grant_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY gr_service_all ON public.grant_requirements
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY gr_auth_read ON public.grant_requirements
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_gr_updated_at
  BEFORE UPDATE ON public.grant_requirements
  FOR EACH ROW EXECUTE FUNCTION public.grant_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_gr_opp ON public.grant_requirements(grant_opportunity_id);
CREATE INDEX IF NOT EXISTS idx_gr_type ON public.grant_requirements(requirement_type);