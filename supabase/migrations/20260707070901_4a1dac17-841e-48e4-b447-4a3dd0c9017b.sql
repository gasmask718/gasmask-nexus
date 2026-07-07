
CREATE TABLE IF NOT EXISTS public.grant_funders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  funder_type text DEFAULT 'foundation' CHECK (funder_type IN ('foundation','government','corporate','community','faith_based','other')),
  website text,
  primary_contact_name text,
  primary_contact_title text,
  primary_contact_email text,
  primary_contact_phone text,
  secondary_contact_name text,
  secondary_contact_email text,
  focus_areas text[],
  grant_size_min numeric,
  grant_size_max numeric,
  application_deadline_typical text,
  accepts_unsolicited boolean DEFAULT true,
  relationship_status text DEFAULT 'prospect' CHECK (relationship_status IN ('prospect','contacted','responded','relationship','declined','do_not_contact')),
  relationship_notes text,
  last_contact_date date,
  next_follow_up_date date,
  total_awarded numeric DEFAULT 0,
  total_applications integer DEFAULT 0,
  success_rate numeric,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grant_funders TO authenticated;
GRANT ALL ON public.grant_funders TO service_role;

ALTER TABLE public.grant_funders ENABLE ROW LEVEL SECURITY;

CREATE POLICY gf_service ON public.grant_funders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY gf_auth    ON public.grant_funders FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.grant_funder_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funder_id uuid REFERENCES public.grant_funders(id) ON DELETE CASCADE,
  interaction_type text CHECK (interaction_type IN ('email','call','meeting','application_submitted','award_received','rejection_received','follow_up','note')),
  subject text,
  notes text,
  outcome text,
  interaction_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grant_funder_interactions TO authenticated;
GRANT ALL ON public.grant_funder_interactions TO service_role;

ALTER TABLE public.grant_funder_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY gfi_service ON public.grant_funder_interactions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY gfi_auth    ON public.grant_funder_interactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_grant_funders_updated_at
  BEFORE UPDATE ON public.grant_funders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
