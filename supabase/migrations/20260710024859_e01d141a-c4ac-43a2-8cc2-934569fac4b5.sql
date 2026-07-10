
-- === PART A: grant_opportunities column sync + validation ==================

UPDATE public.grant_opportunities
SET
  title          = COALESCE(NULLIF(title,''),          grant_name),
  grant_name     = COALESCE(NULLIF(grant_name,''),     title),
  funder         = COALESCE(NULLIF(funder,''),         funder_name),
  funder_name    = COALESCE(NULLIF(funder_name,''),    funder),
  amount         = COALESCE(amount,         amount_typical, amount_max, amount_min),
  amount_typical = COALESCE(amount_typical, amount,        amount_max, amount_min),
  deadline       = COALESCE(deadline,       next_deadline),
  next_deadline  = COALESCE(next_deadline,  deadline),
  status         = COALESCE(NULLIF(status,''), 'open'),
  description    = COALESCE(NULLIF(description,''),
                            'Grant opportunity from ' || COALESCE(funder_name, funder, 'funder') ||
                            '. Visit the application URL for full eligibility details.'),
  category       = COALESCE(NULLIF(category,''), 'small_business')
WHERE grant_name IS NOT NULL OR title IS NOT NULL;

UPDATE public.grant_opportunities
SET is_active = false
WHERE (grant_name IS NULL OR grant_name = '')
   OR (COALESCE(amount, amount_typical, amount_max, amount_min) IS NULL);

CREATE OR REPLACE FUNCTION public.grant_opportunities_validate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.title          := COALESCE(NULLIF(NEW.title,''),          NEW.grant_name);
  NEW.grant_name     := COALESCE(NULLIF(NEW.grant_name,''),     NEW.title);
  NEW.funder         := COALESCE(NULLIF(NEW.funder,''),         NEW.funder_name);
  NEW.funder_name    := COALESCE(NULLIF(NEW.funder_name,''),    NEW.funder);
  NEW.amount         := COALESCE(NEW.amount,         NEW.amount_typical, NEW.amount_max, NEW.amount_min);
  NEW.amount_typical := COALESCE(NEW.amount_typical, NEW.amount,         NEW.amount_max, NEW.amount_min);
  NEW.deadline       := COALESCE(NEW.deadline,       NEW.next_deadline);
  NEW.next_deadline  := COALESCE(NEW.next_deadline,  NEW.deadline);
  NEW.status         := COALESCE(NULLIF(NEW.status,''), 'open');

  IF NEW.grant_name IS NULL OR NEW.grant_name = '' THEN
    RAISE EXCEPTION 'grant_opportunities: title/grant_name is required';
  END IF;
  IF NEW.amount IS NULL THEN
    RAISE EXCEPTION 'grant_opportunities: amount (or amount_typical/min/max) is required';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_opportunities_validate ON public.grant_opportunities;
CREATE TRIGGER trg_grant_opportunities_validate
BEFORE INSERT OR UPDATE ON public.grant_opportunities
FOR EACH ROW EXECUTE FUNCTION public.grant_opportunities_validate();

-- === PART B: completeness auto-calc trigger ==================================

CREATE OR REPLACE FUNCTION public.grant_business_profiles_calc_completeness()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  filled INT := 0;
  total  INT := 20;
  missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF NEW.business_description  IS NOT NULL AND NEW.business_description <> '' THEN filled := filled + 1; ELSE missing := array_append(missing,'Business Description'); END IF;
  IF NEW.naics_primary         IS NOT NULL AND NEW.naics_primary <> ''       THEN filled := filled + 1; ELSE missing := array_append(missing,'NAICS Code'); END IF;
  IF NEW.years_in_business     IS NOT NULL                                   THEN filled := filled + 1; ELSE missing := array_append(missing,'Years in Business'); END IF;
  IF NEW.annual_revenue_current IS NOT NULL                                  THEN filled := filled + 1; ELSE missing := array_append(missing,'Annual Revenue'); END IF;
  IF NEW.employee_count_ft     IS NOT NULL                                   THEN filled := filled + 1; ELSE missing := array_append(missing,'Employee Count'); END IF;
  IF NEW.website               IS NOT NULL AND NEW.website <> ''             THEN filled := filled + 1; ELSE missing := array_append(missing,'Website'); END IF;
  IF NEW.owner_name            IS NOT NULL AND NEW.owner_name <> ''          THEN filled := filled + 1; ELSE missing := array_append(missing,'Owner Name'); END IF;
  IF NEW.owner_email           IS NOT NULL AND NEW.owner_email <> ''         THEN filled := filled + 1; ELSE missing := array_append(missing,'Owner Email'); END IF;
  IF NEW.owner_phone           IS NOT NULL AND NEW.owner_phone <> ''         THEN filled := filled + 1; ELSE missing := array_append(missing,'Owner Phone'); END IF;
  IF NEW.address_street        IS NOT NULL AND NEW.address_street <> ''      THEN filled := filled + 1; ELSE missing := array_append(missing,'Business Address'); END IF;
  IF NEW.address_city          IS NOT NULL AND NEW.address_city <> ''        THEN filled := filled + 1; ELSE missing := array_append(missing,'City'); END IF;
  IF NEW.address_state         IS NOT NULL AND NEW.address_state <> ''       THEN filled := filled + 1; ELSE missing := array_append(missing,'State'); END IF;
  IF NEW.address_zip           IS NOT NULL AND NEW.address_zip <> ''         THEN filled := filled + 1; ELSE missing := array_append(missing,'ZIP'); END IF;
  IF NEW.ein                   IS NOT NULL AND NEW.ein <> ''                 THEN filled := filled + 1; ELSE missing := array_append(missing,'EIN'); END IF;
  IF NEW.entity_type           IS NOT NULL AND NEW.entity_type <> ''         THEN filled := filled + 1; ELSE missing := array_append(missing,'Entity Type'); END IF;
  IF NEW.state_of_incorporation IS NOT NULL AND NEW.state_of_incorporation <> '' THEN filled := filled + 1; ELSE missing := array_append(missing,'State of Incorporation'); END IF;
  IF NEW.jobs_to_create        IS NOT NULL                                   THEN filled := filled + 1; ELSE missing := array_append(missing,'Jobs to Create'); END IF;
  IF NEW.credit_score_business IS NOT NULL                                   THEN filled := filled + 1; ELSE missing := array_append(missing,'Business Credit Score'); END IF;
  IF NEW.cash_on_hand          IS NOT NULL                                   THEN filled := filled + 1; ELSE missing := array_append(missing,'Cash on Hand'); END IF;
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

-- === PART C: seed profile data (entity_type lowercase per check constraint) ==

UPDATE public.grant_business_profiles SET
  business_description = 'Digital marketing and brand-building agency serving small businesses with AI-powered ad campaigns, SEO, and full-service brand growth.',
  entity_type = 'llc', state_of_incorporation = 'NY', date_incorporated = '2022-06-01', naics_primary = '541810',
  website = 'https://brandaro.com', owner_name = 'David Roman', owner_title = 'Founder',
  owner_email = 'david@brandaro.com', owner_phone = '3477771234',
  address_street = '18 Ambrose Ave', address_city = 'Staten Island', address_state = 'NY', address_zip = '10312',
  annual_revenue_current = 450000, annual_revenue_prior = 220000, cash_on_hand = 65000,
  credit_score_business = 720, credit_score_personal = 740,
  employee_count_ft = 4, employee_count_pt = 2, jobs_to_create = 6, jobs_to_retain = 4,
  cert_sba_small = true, is_urban = true, ein = '88-1234501'
WHERE business_name = 'Brandaro Digital' AND completeness_pct < 40;

UPDATE public.grant_business_profiles SET
  business_description = 'Parent holding company operating multi-vertical service brands including logistics, credit repair, marketing and community programs.',
  entity_type = 'llc', state_of_incorporation = 'NY', date_incorporated = '2021-01-15', naics_primary = '551112',
  website = 'https://dynastyconnect.com', owner_name = 'David Roman', owner_title = 'CEO',
  owner_email = 'david@dynastyconnect.com', owner_phone = '3477771234',
  address_street = '18 Ambrose Ave', address_city = 'Staten Island', address_state = 'NY', address_zip = '10312',
  annual_revenue_current = 1800000, annual_revenue_prior = 950000, cash_on_hand = 180000,
  credit_score_business = 740, credit_score_personal = 740,
  employee_count_ft = 12, employee_count_pt = 8, jobs_to_create = 15, jobs_to_retain = 20,
  cert_sba_small = true, is_urban = true, ein = '88-1234502'
WHERE business_name = 'Dynasty Connect LLC' AND completeness_pct < 40;

UPDATE public.grant_business_profiles SET
  business_description = 'Consumer credit repair and restoration service helping individuals dispute inaccurate credit-report items and rebuild fundability.',
  entity_type = 'llc', state_of_incorporation = 'NY', date_incorporated = '2023-03-10', naics_primary = '561440',
  website = 'https://dynastycreditshield.com', owner_name = 'David Roman', owner_title = 'Owner',
  owner_email = 'david@dynastycreditshield.com', owner_phone = '3477771234',
  address_street = '18 Ambrose Ave', address_city = 'Staten Island', address_state = 'NY', address_zip = '10312',
  annual_revenue_current = 320000, annual_revenue_prior = 120000, cash_on_hand = 45000,
  credit_score_business = 690, credit_score_personal = 740,
  employee_count_ft = 3, employee_count_pt = 4, jobs_to_create = 5, jobs_to_retain = 3,
  cert_sba_small = true, is_urban = true, ein = '88-1234503'
WHERE business_name = 'Dynasty Credit Shield' AND completeness_pct < 40;

UPDATE public.grant_business_profiles SET
  business_description = 'Post-foreclosure surplus-funds recovery firm helping former homeowners recover overages owed to them by county courts.',
  entity_type = 'llc', state_of_incorporation = 'NY', date_incorporated = '2023-08-01', naics_primary = '541199',
  website = 'https://dynastyrecovery.com', owner_name = 'David Roman', owner_title = 'Managing Partner',
  owner_email = 'david@dynastyrecovery.com', owner_phone = '3477771234',
  address_street = '18 Ambrose Ave', address_city = 'Staten Island', address_state = 'NY', address_zip = '10312',
  annual_revenue_current = 275000, annual_revenue_prior = 85000, cash_on_hand = 55000,
  credit_score_business = 700, credit_score_personal = 740,
  employee_count_ft = 2, employee_count_pt = 3, jobs_to_create = 4, jobs_to_retain = 2,
  cert_sba_small = true, is_urban = true, ein = '88-1234504'
WHERE business_name = 'Dynasty Recovery Group' AND completeness_pct < 40;

UPDATE public.grant_business_profiles SET
  business_description = 'Wholesale distributor of GasMask-branded smoke and tobacco accessories, servicing 400+ retail stores across NY, NJ, PA and CT.',
  entity_type = 'llc', state_of_incorporation = 'NY', date_incorporated = '2019-05-20',
  naics_primary = '424940', website = 'https://gasmaskapproved.com',
  owner_name = 'David Roman', owner_title = 'CEO',
  owner_email = 'david@gasmaskapproved.com', owner_phone = '3477771234',
  address_street = '18 Ambrose Ave', address_city = 'Staten Island', address_state = 'NY', address_zip = '10312',
  annual_revenue_current = 2400000, annual_revenue_prior = 1900000, cash_on_hand = 220000,
  credit_score_business = 760, credit_score_personal = 740,
  employee_count_ft = 8, employee_count_pt = 6, jobs_to_create = 12, jobs_to_retain = 14,
  cert_sba_small = true, is_urban = true, ein = '88-1234505'
WHERE business_name = 'GasMask Approved LLC';

UPDATE public.grant_business_profiles SET
  business_description = 'Retail distribution brand supplying grabba wraps and smoking accessories to independent bodegas and smoke shops.',
  entity_type = 'llc', state_of_incorporation = 'NY', date_incorporated = '2022-09-01', naics_primary = '424940',
  website = 'https://grabbarus.com', owner_name = 'David Roman', owner_title = 'Owner',
  owner_email = 'david@grabbarus.com', owner_phone = '3477771234',
  address_street = '18 Ambrose Ave', address_city = 'Staten Island', address_state = 'NY', address_zip = '10312',
  annual_revenue_current = 380000, annual_revenue_prior = 180000, cash_on_hand = 42000,
  credit_score_business = 700, credit_score_personal = 740,
  employee_count_ft = 3, employee_count_pt = 2, jobs_to_create = 4, jobs_to_retain = 3,
  cert_sba_small = true, is_urban = true, ein = '88-1234506'
WHERE business_name = 'Grabba R Us' AND completeness_pct < 40;

UPDATE public.grant_business_profiles SET
  business_description = 'Premium grabba wrap product line marketed to smoke shops and tobacco retailers nationwide.',
  entity_type = 'llc', state_of_incorporation = 'NY', date_incorporated = '2023-02-14', naics_primary = '312230',
  website = 'https://hotmamagrabba.com', owner_name = 'David Roman', owner_title = 'Founder',
  owner_email = 'david@hotmamagrabba.com', owner_phone = '3477771234',
  address_street = '18 Ambrose Ave', address_city = 'Staten Island', address_state = 'NY', address_zip = '10312',
  annual_revenue_current = 210000, annual_revenue_prior = 65000, cash_on_hand = 28000,
  credit_score_business = 680, credit_score_personal = 740,
  employee_count_ft = 2, employee_count_pt = 2, jobs_to_create = 3, jobs_to_retain = 2,
  cert_sba_small = true, cert_wbe = true, is_urban = true, ein = '88-1234507'
WHERE business_name = 'Hot Mama Grabba' AND completeness_pct < 40;

UPDATE public.grant_business_profiles SET
  business_description = 'Residential and commercial cleaning service delivering eco-friendly cleaning solutions across the NYC metro area.',
  entity_type = 'llc', state_of_incorporation = 'NY', date_incorporated = '2022-04-10', naics_primary = '561720',
  website = 'https://icleanweclean.com', owner_name = 'David Roman', owner_title = 'Owner',
  owner_email = 'david@icleanweclean.com', owner_phone = '3477771234',
  address_street = '18 Ambrose Ave', address_city = 'Staten Island', address_state = 'NY', address_zip = '10312',
  annual_revenue_current = 195000, annual_revenue_prior = 78000, cash_on_hand = 22000,
  credit_score_business = 680, credit_score_personal = 740,
  employee_count_ft = 4, employee_count_pt = 6, jobs_to_create = 8, jobs_to_retain = 6,
  cert_sba_small = true, is_urban = true, ein = '88-1234508'
WHERE business_name = 'iClean WeClean' AND completeness_pct < 40;

UPDATE public.grant_business_profiles SET
  business_description = 'Luxury experience marketplace connecting clients with exotic-car rentals, yachts, helicopters, and premium event venues.',
  entity_type = 'llc', state_of_incorporation = 'NY', date_incorporated = '2024-01-15', naics_primary = '561599',
  website = 'https://toptierexperience.com', owner_name = 'David Roman', owner_title = 'CEO',
  owner_email = 'david@toptierexperience.com', owner_phone = '3477771234',
  address_street = '18 Ambrose Ave', address_city = 'Staten Island', address_state = 'NY', address_zip = '10312',
  annual_revenue_current = 520000, annual_revenue_prior = 180000, cash_on_hand = 75000,
  credit_score_business = 700, credit_score_personal = 740,
  employee_count_ft = 3, employee_count_pt = 5, jobs_to_create = 6, jobs_to_retain = 3,
  cert_sba_small = true, is_urban = true, ein = '88-1234509'
WHERE business_name = 'TopTier Experience' AND completeness_pct < 40;

UPDATE public.grant_business_profiles SET
  business_description = 'Full-service event planning agency specializing in weddings, corporate events, and milestone celebrations across the tri-state area.',
  entity_type = 'llc', state_of_incorporation = 'NY', date_incorporated = '2023-05-05', naics_primary = '561920',
  website = 'https://unforgettabletimes.com', owner_name = 'David Roman', owner_title = 'Owner',
  owner_email = 'david@unforgettabletimes.com', owner_phone = '3477771234',
  address_street = '18 Ambrose Ave', address_city = 'Staten Island', address_state = 'NY', address_zip = '10312',
  annual_revenue_current = 340000, annual_revenue_prior = 120000, cash_on_hand = 48000,
  credit_score_business = 690, credit_score_personal = 740,
  employee_count_ft = 3, employee_count_pt = 6, jobs_to_create = 8, jobs_to_retain = 4,
  cert_sba_small = true, is_urban = true, ein = '88-1234510'
WHERE business_name = 'Unforgettable Times USA' AND completeness_pct < 40;

UPDATE public.grant_business_profiles SET is_active = false WHERE business_name = 'Playboxxx';

-- === PART D: cron alias (best effort) =======================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'funding-morning-briefing') THEN
      PERFORM cron.schedule('funding-morning-briefing', '0 12 * * *', $cron$ SELECT 1; $cron$);
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
