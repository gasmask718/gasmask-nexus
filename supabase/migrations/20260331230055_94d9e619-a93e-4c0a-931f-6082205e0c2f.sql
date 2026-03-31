
CREATE TABLE IF NOT EXISTS ut_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT,
  lead_type TEXT,
  business_name TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  instagram_handle TEXT,
  followers_count INTEGER DEFAULT 0,
  engagement_rate DECIMAL DEFAULT 0,
  website TEXT,
  google_rating DECIMAL DEFAULT 0,
  google_reviews INTEGER DEFAULT 0,
  linkedin_url TEXT,
  grade TEXT DEFAULT 'C',
  score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'new',
  outreach_channel TEXT,
  outreach_sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  notes TEXT,
  ai_summary TEXT,
  ai_outreach_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ut_outreach_sequences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES ut_leads(id),
  sequence_type TEXT,
  channel TEXT,
  step_number INTEGER DEFAULT 1,
  message TEXT,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ut_lead_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_name TEXT,
  is_connected BOOLEAN DEFAULT false,
  api_key_configured BOOLEAN DEFAULT false,
  last_run_at TIMESTAMPTZ,
  last_run_count INTEGER DEFAULT 0,
  total_leads_pulled INTEGER DEFAULT 0,
  status TEXT DEFAULT 'disconnected',
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ut_automation_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_type TEXT,
  source TEXT,
  status TEXT DEFAULT 'running',
  leads_found INTEGER DEFAULT 0,
  leads_graded INTEGER DEFAULT 0,
  outreach_sent INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ut_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ut_outreach_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE ut_lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE ut_automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read ut_leads" ON ut_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert ut_leads" ON ut_leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update ut_leads" ON ut_leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete ut_leads" ON ut_leads FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated read outreach" ON ut_outreach_sequences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert outreach" ON ut_outreach_sequences FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update outreach" ON ut_outreach_sequences FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete outreach" ON ut_outreach_sequences FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated read sources" ON ut_lead_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert sources" ON ut_lead_sources FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update sources" ON ut_lead_sources FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read runs" ON ut_automation_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert runs" ON ut_automation_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update runs" ON ut_automation_runs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Service role policies for edge functions
CREATE POLICY "Service role all ut_leads" ON ut_leads FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role all outreach" ON ut_outreach_sequences FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role all sources" ON ut_lead_sources FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role all runs" ON ut_automation_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
