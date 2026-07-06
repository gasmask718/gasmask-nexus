-- 1. grant_opportunities
CREATE TABLE public.grant_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_name text NOT NULL,
  funder_name text NOT NULL,
  funder_type text,
  category text,
  description text,
  amount_min numeric, amount_max numeric, amount_typical numeric,
  min_credit_score int DEFAULT 0,
  min_time_in_business_months int DEFAULT 0,
  requires_nonprofit boolean DEFAULT false,
  requires_minority_owned boolean DEFAULT false,
  requires_women_owned boolean DEFAULT false,
  requires_veteran_owned boolean DEFAULT false,
  eligible_states text[] DEFAULT '{}',
  eligible_industries text[] DEFAULT '{}',
  next_deadline date,
  deadline_type text DEFAULT 'fixed',
  application_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. grant_applications
CREATE TABLE public.grant_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funding_client_id uuid REFERENCES public.funding_clients(id) ON DELETE SET NULL,
  uben_source_id uuid,
  opportunity_id uuid REFERENCES public.grant_opportunities(id) ON DELETE SET NULL,
  applicant_type text NOT NULL DEFAULT 'manual',
  grant_name text NOT NULL,
  funder_name text NOT NULL,
  amount_requested numeric,
  amount_awarded numeric,
  status text NOT NULL DEFAULT 'drafting',
  deadline date,
  application_date date,
  award_date date,
  report_due date,
  contact_name text, contact_email text,
  notes text,
  ai_draft text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX ON public.grant_applications (funding_client_id);
CREATE INDEX ON public.grant_applications (status);
CREATE INDEX ON public.grant_applications (deadline);

-- 3. grant_documents
CREATE TABLE public.grant_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.grant_applications(id) ON DELETE CASCADE,
  doc_name text NOT NULL, doc_type text,
  storage_path text, mime_type text, size_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz DEFAULT now()
);

-- 4. grant_tasks
CREATE TABLE public.grant_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.grant_applications(id) ON DELETE CASCADE,
  title text NOT NULL, description text,
  due_date date,
  status text NOT NULL DEFAULT 'open',
  assigned_to uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. client_grant_matches
CREATE TABLE public.client_grant_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.funding_clients(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.grant_opportunities(id) ON DELETE CASCADE,
  grant_name text NOT NULL, funder_name text NOT NULL,
  grant_amount numeric, deadline date,
  eligibility_score int NOT NULL,
  eligibility_notes text,
  status text NOT NULL DEFAULT 'identified',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (client_id, opportunity_id)
);

-- 6. funding_clients tracking columns
ALTER TABLE public.funding_clients
  ADD COLUMN IF NOT EXISTS grant_eligible boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS grant_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS minority_owned boolean,
  ADD COLUMN IF NOT EXISTS women_owned boolean,
  ADD COLUMN IF NOT EXISTS veteran_owned boolean;

-- 7. GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grant_opportunities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grant_applications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grant_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grant_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_grant_matches TO authenticated;
GRANT ALL ON public.grant_opportunities TO service_role;
GRANT ALL ON public.grant_applications TO service_role;
GRANT ALL ON public.grant_documents TO service_role;
GRANT ALL ON public.grant_tasks TO service_role;
GRANT ALL ON public.client_grant_matches TO service_role;

-- 8. RLS
ALTER TABLE public.grant_opportunities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_applications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_grant_matches  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth all" ON public.grant_opportunities   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all" ON public.grant_applications    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all" ON public.grant_documents       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all" ON public.grant_tasks           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all" ON public.client_grant_matches  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public AS $$
  BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER t_grant_opportunities_uat  BEFORE UPDATE ON public.grant_opportunities  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER t_grant_applications_uat   BEFORE UPDATE ON public.grant_applications   FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER t_grant_tasks_uat          BEFORE UPDATE ON public.grant_tasks          FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER t_client_grant_matches_uat BEFORE UPDATE ON public.client_grant_matches FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 10. Seed 10 opportunities
INSERT INTO public.grant_opportunities
  (grant_name, funder_name, funder_type, category, description, amount_min, amount_max, amount_typical,
   min_credit_score, min_time_in_business_months, requires_nonprofit, requires_minority_owned, requires_women_owned,
   deadline_type, application_url)
VALUES
  ('Comcast RISE Grant','Comcast NBCUniversal','corporate','private','Cash grants + marketing services for small businesses.', 5000, 10000, 10000, 0, 12, false, false, false, 'quarterly', 'https://www.comcastrise.com/'),
  ('Amber Grant for Women','WomensNet','private','private','$10K monthly + $25K annual grant for women entrepreneurs.', 10000, 25000, 10000, 0, 0, false, false, true, 'rolling', 'https://ambergrantsforwomen.com/'),
  ('NAACP Powershift Entrepreneur Grant','NAACP','private','private','Grants for Black-owned small businesses.', 10000, 25000, 10000, 0, 12, false, true, false, 'annual', 'https://naacp.org/'),
  ('FedEx Small Business Grant','FedEx','corporate','corporate','Annual grant contest for U.S. small businesses.', 20000, 50000, 30000, 0, 6, false, false, false, 'annual', 'https://smallbusinessgrant.fedex.com/'),
  ('Hello Alice Small Business Grant','Hello Alice','private','private','Recurring grants across multiple programs.', 5000, 25000, 10000, 0, 0, false, false, false, 'rolling', 'https://helloalice.com/grants'),
  ('Verizon Digital Ready Grant','Verizon','corporate','corporate','$10K grants + free digital training.', 10000, 10000, 10000, 0, 6, false, false, false, 'quarterly', 'https://digitalready.verizonwireless.com/'),
  ('IFundWomen Universal Grant','IFundWomen','private','private','Rolling grants for women-owned businesses.', 2500, 25000, 10000, 0, 0, false, false, true, 'rolling', 'https://ifundwomen.com/grants'),
  ('NASE Growth Grant','National Association for the Self-Employed','private','private','Small growth grants for members.', 500, 4000, 4000, 0, 12, false, false, false, 'quarterly', 'https://www.nase.org/business-help/growth-grants'),
  ('SBA Growth Accelerator Fund','U.S. Small Business Administration','federal','federal','Federal accelerator prize competition.', 50000, 200000, 50000, 640, 24, false, false, false, 'annual', 'https://www.sba.gov/'),
  ('MBDA Business Center Grant','U.S. Minority Business Development Agency','federal','federal','Support for minority-owned enterprises.', 25000, 100000, 50000, 0, 12, false, true, false, 'annual', 'https://www.mbda.gov/');

-- 11. Copy 5 UBEN rows into grant_applications (leaves uben_grant_applications untouched)
INSERT INTO public.grant_applications
  (uben_source_id, applicant_type, grant_name, funder_name, amount_requested, amount_awarded,
   status, deadline, application_date, award_date, report_due, contact_name, contact_email, notes)
SELECT id, 'uben', grant_name, funder_name, amount_requested, amount_awarded,
       CASE
         WHEN status ILIKE '%award%'    THEN 'awarded'
         WHEN status ILIKE '%deni%'     THEN 'denied'
         WHEN status ILIKE '%submit%'   THEN 'submitted'
         WHEN status ILIKE '%progress%' THEN 'in_progress'
         WHEN status ILIKE '%review%'   THEN 'review'
         ELSE 'drafting'
       END,
       deadline, application_date, award_date, report_due, contact_name, contact_email, notes
FROM public.uben_grant_applications;