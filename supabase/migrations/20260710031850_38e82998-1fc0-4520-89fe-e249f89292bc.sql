
-- Section 7 (GR-31): Add bank fields for financial completeness
ALTER TABLE public.grant_business_profiles
  ADD COLUMN IF NOT EXISTS bank_account_exists BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS bank_name TEXT;

-- Extend completeness engine to 25 weighted fields covering all sections.
CREATE OR REPLACE FUNCTION public.grant_business_profiles_calc_completeness()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  filled INT := 0;
  total  INT := 25;
  missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Identity & registration
  IF NEW.business_description  IS NOT NULL AND NEW.business_description <> '' THEN filled := filled + 1; ELSE missing := array_append(missing,'Business Description'); END IF;
  IF NEW.naics_primary         IS NOT NULL AND NEW.naics_primary <> ''       THEN filled := filled + 1; ELSE missing := array_append(missing,'NAICS Code'); END IF;
  IF NEW.years_in_business     IS NOT NULL                                   THEN filled := filled + 1; ELSE missing := array_append(missing,'Years in Business'); END IF;
  IF NEW.website               IS NOT NULL AND NEW.website <> ''             THEN filled := filled + 1; ELSE missing := array_append(missing,'Website'); END IF;
  IF NEW.ein                   IS NOT NULL AND NEW.ein <> ''                 THEN filled := filled + 1; ELSE missing := array_append(missing,'EIN'); END IF;
  IF NEW.entity_type           IS NOT NULL AND NEW.entity_type <> ''         THEN filled := filled + 1; ELSE missing := array_append(missing,'Entity Type'); END IF;
  IF NEW.state_of_incorporation IS NOT NULL AND NEW.state_of_incorporation <> '' THEN filled := filled + 1; ELSE missing := array_append(missing,'State of Incorporation'); END IF;
  IF NEW.date_incorporated     IS NOT NULL                                   THEN filled := filled + 1; ELSE missing := array_append(missing,'Date Incorporated'); END IF;
  IF COALESCE(NEW.sam_registered,false)                                      THEN filled := filled + 1; ELSE missing := array_append(missing,'SAM Registration'); END IF;
  -- Ownership
  IF NEW.owner_name            IS NOT NULL AND NEW.owner_name <> ''          THEN filled := filled + 1; ELSE missing := array_append(missing,'Owner Name'); END IF;
  IF NEW.owner_email           IS NOT NULL AND NEW.owner_email <> ''         THEN filled := filled + 1; ELSE missing := array_append(missing,'Owner Email'); END IF;
  IF NEW.owner_phone           IS NOT NULL AND NEW.owner_phone <> ''         THEN filled := filled + 1; ELSE missing := array_append(missing,'Owner Phone'); END IF;
  IF NEW.owner_percentage      IS NOT NULL                                   THEN filled := filled + 1; ELSE missing := array_append(missing,'Ownership %'); END IF;
  -- Address
  IF NEW.address_street        IS NOT NULL AND NEW.address_street <> ''      THEN filled := filled + 1; ELSE missing := array_append(missing,'Business Address'); END IF;
  IF NEW.address_city          IS NOT NULL AND NEW.address_city <> ''        THEN filled := filled + 1; ELSE missing := array_append(missing,'City'); END IF;
  IF NEW.address_state         IS NOT NULL AND NEW.address_state <> ''       THEN filled := filled + 1; ELSE missing := array_append(missing,'State'); END IF;
  IF NEW.address_zip           IS NOT NULL AND NEW.address_zip <> ''         THEN filled := filled + 1; ELSE missing := array_append(missing,'ZIP'); END IF;
  -- Financials
  IF NEW.annual_revenue_current IS NOT NULL                                  THEN filled := filled + 1; ELSE missing := array_append(missing,'Annual Revenue'); END IF;
  IF NEW.cash_on_hand          IS NOT NULL                                   THEN filled := filled + 1; ELSE missing := array_append(missing,'Cash on Hand'); END IF;
  IF NEW.credit_score_business IS NOT NULL                                   THEN filled := filled + 1; ELSE missing := array_append(missing,'Business Credit Score'); END IF;
  IF COALESCE(NEW.bank_account_exists,false)                                 THEN filled := filled + 1; ELSE missing := array_append(missing,'Bank Account'); END IF;
  -- Employees & jobs
  IF NEW.employee_count_ft     IS NOT NULL                                   THEN filled := filled + 1; ELSE missing := array_append(missing,'Employee Count'); END IF;
  IF NEW.jobs_to_create        IS NOT NULL                                   THEN filled := filled + 1; ELSE missing := array_append(missing,'Jobs to Create'); END IF;
  -- Documents (at least one core doc)
  IF (COALESCE(NEW.doc_ein_letter,false) OR COALESCE(NEW.doc_tax_returns_current,false) OR COALESCE(NEW.doc_bank_statements,false) OR COALESCE(NEW.doc_profit_loss,false) OR COALESCE(NEW.doc_business_license,false) OR COALESCE(NEW.doc_insurance,false))
    THEN filled := filled + 1; ELSE missing := array_append(missing,'Required Documents'); END IF;
  -- Certifications (at least one)
  IF (COALESCE(NEW.cert_mbe,false) OR COALESCE(NEW.cert_wbe,false) OR COALESCE(NEW.cert_sdvob,false) OR COALESCE(NEW.cert_veteran,false) OR COALESCE(NEW.cert_8a,false) OR COALESCE(NEW.cert_hubzone,false) OR COALESCE(NEW.cert_sba_small,false) OR COALESCE(NEW.cert_dbe,false))
    THEN filled := filled + 1; ELSE missing := array_append(missing,'At least one certification'); END IF;

  NEW.completeness_pct     := ROUND(filled::numeric * 100 / total);
  NEW.completeness_score   := NEW.completeness_pct;
  NEW.completeness_missing := missing;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gbp_completeness ON public.grant_business_profiles;
CREATE TRIGGER trg_gbp_completeness
BEFORE INSERT OR UPDATE ON public.grant_business_profiles
FOR EACH ROW EXECUTE FUNCTION public.grant_business_profiles_calc_completeness();

-- Force recompute for every existing row (no-op UPDATE fires the trigger)
UPDATE public.grant_business_profiles SET updated_at = now();
