
-- Grant applications
CREATE TABLE public.uben_grant_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_name text NOT NULL,
  funder_name text NOT NULL,
  funder_type text CHECK (funder_type IN ('federal','state','corporate','foundation','other')),
  amount_requested numeric,
  amount_awarded numeric,
  status text NOT NULL DEFAULT 'researching' CHECK (status IN ('researching','applied','pending','awarded','denied','closed')),
  deadline date,
  application_date date,
  award_date date,
  report_due date,
  contact_name text,
  contact_email text,
  notes text,
  dynasty_business text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uben_grant_applications TO authenticated;
GRANT ALL ON public.uben_grant_applications TO service_role;
ALTER TABLE public.uben_grant_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY uben_grants_service ON public.uben_grant_applications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY uben_grants_auth_all ON public.uben_grant_applications FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Donors
CREATE TABLE public.uben_donors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_name text NOT NULL,
  donor_email text,
  donor_phone text,
  donor_type text DEFAULT 'individual' CHECK (donor_type IN ('individual','corporate','foundation','government')),
  total_donated numeric DEFAULT 0,
  first_donation_date date,
  last_donation_date date,
  is_recurring boolean DEFAULT false,
  stripe_customer_id text,
  notes text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uben_donors TO authenticated;
GRANT ALL ON public.uben_donors TO service_role;
ALTER TABLE public.uben_donors ENABLE ROW LEVEL SECURITY;
CREATE POLICY uben_donors_service ON public.uben_donors FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY uben_donors_auth_all ON public.uben_donors FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Donations
CREATE TABLE public.uben_donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid REFERENCES public.uben_donors(id) ON DELETE SET NULL,
  donor_name text,
  donor_email text,
  amount numeric NOT NULL,
  donation_type text DEFAULT 'one_time' CHECK (donation_type IN ('one_time','monthly','annual','in_kind')),
  stripe_payment_intent_id text,
  stripe_session_id text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
  notes text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uben_donations TO authenticated;
GRANT ALL ON public.uben_donations TO service_role;
ALTER TABLE public.uben_donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY uben_donations_service ON public.uben_donations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY uben_donations_auth_all ON public.uben_donations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Beneficiaries
CREATE TABLE public.uben_beneficiaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  program_id uuid REFERENCES public.uben_programs(id) ON DELETE SET NULL,
  enrollment_date date,
  status text DEFAULT 'active' CHECK (status IN ('active','completed','withdrawn')),
  outcome_notes text,
  dynasty_business_referred text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uben_beneficiaries TO authenticated;
GRANT ALL ON public.uben_beneficiaries TO service_role;
ALTER TABLE public.uben_beneficiaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY uben_beneficiaries_service ON public.uben_beneficiaries FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY uben_beneficiaries_auth_all ON public.uben_beneficiaries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- updated_at trigger for grants
CREATE OR REPLACE FUNCTION public.uben_touch_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER uben_grants_touch BEFORE UPDATE ON public.uben_grant_applications
FOR EACH ROW EXECUTE FUNCTION public.uben_touch_updated_at();

-- Seed compliance calendar
INSERT INTO public.uben_compliance_calendar (title, due_date, category, status, notes) VALUES
('SAM.gov Annual Renewal', '2026-12-01', 'registration', 'pending', 'Must renew every 12 months'),
('IRS Form 990 Filing', '2026-11-15', 'tax', 'pending', 'Annual IRS filing for 501c3'),
('Comcast RISE Application', '2026-08-01', 'grant', 'pending', 'Submit application at comcastrise.com'),
('State Non-Profit Registration Renewal', '2026-12-31', 'registration', 'pending', 'Annual state filing required'),
('Board Meeting Q3', '2026-09-15', 'governance', 'pending', 'Quarterly board meeting')
ON CONFLICT DO NOTHING;
