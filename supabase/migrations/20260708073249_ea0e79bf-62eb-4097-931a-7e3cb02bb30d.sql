
-- GEE-2 · Migrations 3+4 + Seed 11 business shells

-- =========================================================
-- 2.3 grant_eligibility_results
-- =========================================================
CREATE TABLE IF NOT EXISTS public.grant_eligibility_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_profile_id uuid REFERENCES public.grant_business_profiles(id) ON DELETE CASCADE,
  grant_opportunity_id uuid REFERENCES public.grant_opportunities(id) ON DELETE CASCADE,

  eligibility_status text NOT NULL
    CHECK (eligibility_status IN ('eligible','partially_eligible','needs_review','not_eligible')),
  eligibility_score integer DEFAULT 0,

  requirements_met jsonb DEFAULT '[]'::jsonb,
  requirements_missing jsonb DEFAULT '[]'::jsonb,
  requirements_failed jsonb DEFAULT '[]'::jsonb,

  ai_recommendation text,
  ai_action_plan text,
  ai_success_probability integer,

  application_status text DEFAULT 'not_started'
    CHECK (application_status IN ('not_started','in_progress','package_ready','david_approved','submitted','awarded','rejected')),
  david_approved_at timestamptz,
  submitted_at timestamptz,

  last_checked_at timestamptz DEFAULT now(),
  next_check_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (business_profile_id, grant_opportunity_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grant_eligibility_results TO authenticated;
GRANT ALL ON public.grant_eligibility_results TO service_role;

ALTER TABLE public.grant_eligibility_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY ger_service ON public.grant_eligibility_results
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY ger_read ON public.grant_eligibility_results
  FOR SELECT TO authenticated USING (true);
CREATE POLICY ger_insert ON public.grant_eligibility_results
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY ger_update ON public.grant_eligibility_results
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ger_business ON public.grant_eligibility_results(business_profile_id);
CREATE INDEX IF NOT EXISTS idx_ger_opp ON public.grant_eligibility_results(grant_opportunity_id);
CREATE INDEX IF NOT EXISTS idx_ger_status ON public.grant_eligibility_results(eligibility_status);
CREATE INDEX IF NOT EXISTS idx_ger_app_status ON public.grant_eligibility_results(application_status);

CREATE TRIGGER trg_ger_updated_at
  BEFORE UPDATE ON public.grant_eligibility_results
  FOR EACH ROW EXECUTE FUNCTION public.grant_set_updated_at();

-- =========================================================
-- 2.4 grant_application_packages
-- =========================================================
CREATE TABLE IF NOT EXISTS public.grant_application_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eligibility_result_id uuid REFERENCES public.grant_eligibility_results(id) ON DELETE CASCADE,
  business_profile_id uuid REFERENCES public.grant_business_profiles(id),
  grant_opportunity_id uuid REFERENCES public.grant_opportunities(id),

  cover_letter text,
  executive_summary text,
  business_narrative text,
  fund_usage_plan text,
  community_impact_statement text,
  job_creation_plan text,
  qa_answers jsonb DEFAULT '[]'::jsonb,

  documents_required text[],
  documents_ready text[],
  documents_missing text[],

  generation_status text DEFAULT 'pending'
    CHECK (generation_status IN ('pending','generating','ready','submitted')),
  generated_at timestamptz,
  submitted_at timestamptz,
  submission_confirmation text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grant_application_packages TO authenticated;
GRANT ALL ON public.grant_application_packages TO service_role;

ALTER TABLE public.grant_application_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY gap_service ON public.grant_application_packages
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY gap_read ON public.grant_application_packages
  FOR SELECT TO authenticated USING (true);
CREATE POLICY gap_insert ON public.grant_application_packages
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY gap_update ON public.grant_application_packages
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_gap_eligibility ON public.grant_application_packages(eligibility_result_id);
CREATE INDEX IF NOT EXISTS idx_gap_business ON public.grant_application_packages(business_profile_id);
CREATE INDEX IF NOT EXISTS idx_gap_opp ON public.grant_application_packages(grant_opportunity_id);
CREATE INDEX IF NOT EXISTS idx_gap_status ON public.grant_application_packages(generation_status);

CREATE TRIGGER trg_gap_updated_at
  BEFORE UPDATE ON public.grant_application_packages
  FOR EACH ROW EXECUTE FUNCTION public.grant_set_updated_at();

-- =========================================================
-- Seed 11 business shells (Playboxxx as is_active=false)
-- =========================================================
INSERT INTO public.grant_business_profiles (business_name, entity_type, is_active) VALUES
  ('GasMask Approved LLC',      'llc', true),
  ('Hot Mama Grabba',           'llc', true),
  ('Grabba R Us',               'llc', true),
  ('TopTier Experience',        'llc', true),
  ('Unforgettable Times USA',   'llc', true),
  ('iClean WeClean',            'llc', true),
  ('Brandaro Digital',          'llc', true),
  ('Dynasty Credit Shield',     'llc', true),
  ('Dynasty Recovery Group',    'llc', true),
  ('Dynasty Connect LLC',       'llc', true),
  ('Playboxxx',                 'llc', false)
ON CONFLICT DO NOTHING;
