
-- UBEN Programs
CREATE TABLE public.uben_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  participant_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.uben_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage uben_programs" ON public.uben_programs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- UBEN Impact Log
CREATE TABLE public.uben_impact_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID REFERENCES public.uben_programs(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  participants INTEGER NOT NULL DEFAULT 0,
  outcome_notes TEXT,
  logged_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.uben_impact_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage uben_impact_log" ON public.uben_impact_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- UBEN Partner Activity
CREATE TABLE public.uben_partner_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  people_count INTEGER DEFAULT 0,
  value NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.uben_partner_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage uben_partner_activity" ON public.uben_partner_activity FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- UBEN Compliance Calendar
CREATE TABLE public.uben_compliance_calendar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  due_date DATE NOT NULL,
  category TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.uben_compliance_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage uben_compliance_calendar" ON public.uben_compliance_calendar FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- UBEN Documents
CREATE TABLE public.uben_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.uben_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage uben_documents" ON public.uben_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket for UBEN documents
INSERT INTO storage.buckets (id, name, public) VALUES ('uben-docs', 'uben-docs', false);

CREATE POLICY "Authenticated users can upload uben docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'uben-docs');
CREATE POLICY "Authenticated users can view uben docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'uben-docs');
CREATE POLICY "Authenticated users can delete uben docs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'uben-docs');

-- Pre-populate compliance calendar with standard deadlines
INSERT INTO public.uben_compliance_calendar (title, due_date, category, notes, status) VALUES
  ('IRS Form 990 Annual Filing', '2026-11-15', 'Filings', 'Annual tax-exempt filing due 5.5 months after fiscal year end', 'pending'),
  ('State Charity Registration Renewal', '2026-07-01', 'Filings', 'Annual state charity registration renewal', 'pending'),
  ('Q1 Board Meeting', '2026-03-31', 'Governance', 'Quarterly board meeting requirement', 'pending'),
  ('Q2 Board Meeting', '2026-06-30', 'Governance', 'Quarterly board meeting requirement', 'pending'),
  ('Q3 Board Meeting', '2026-09-30', 'Governance', 'Quarterly board meeting requirement', 'pending'),
  ('Q4 Board Meeting', '2026-12-31', 'Governance', 'Quarterly board meeting requirement', 'pending'),
  ('Annual Report Publication', '2026-06-30', 'Reports', 'Annual impact report publication deadline', 'pending'),
  ('Grant Reporting Deadline — Q2', '2026-07-15', 'Reports', 'Quarterly grant progress report', 'pending'),
  ('Grant Reporting Deadline — Q4', '2027-01-15', 'Reports', 'Quarterly grant progress report', 'pending');
