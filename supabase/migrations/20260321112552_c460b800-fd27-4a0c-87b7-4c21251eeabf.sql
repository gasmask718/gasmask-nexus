ALTER PUBLICATION supabase_realtime ADD TABLE ai_instinct_log;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_work_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_drift_alerts;

CREATE TABLE IF NOT EXISTS weekly_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_text text NOT NULL,
  metrics_snapshot jsonb,
  week_start date,
  week_end date,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outreach_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL,
  contact_name text,
  phone text,
  full_address text,
  city text,
  state_code text,
  zip text,
  store_type text,
  language_detected text DEFAULT 'unknown',
  lead_score integer DEFAULT 0,
  status text DEFAULT 'new',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outreach_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES outreach_leads(id),
  elevenlabs_call_id text,
  call_date timestamptz DEFAULT now(),
  duration_seconds integer,
  outcome text,
  transcript text,
  call_score integer,
  language_detected text,
  objections_detected text[],
  interest_signals text[],
  callback_date timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outreach_sms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES outreach_leads(id),
  call_id uuid REFERENCES outreach_calls(id),
  phone text NOT NULL,
  message text NOT NULL,
  message_type text,
  language text DEFAULT 'english',
  sent_at timestamptz DEFAULT now(),
  delivered boolean DEFAULT false,
  replied boolean DEFAULT false,
  reply_text text,
  twilio_sid text
);

CREATE TABLE IF NOT EXISTS outreach_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  opening text,
  pitch text,
  objection_responses jsonb,
  closing text,
  arabic_variant_opening text,
  arabic_variant_closing text,
  is_active boolean DEFAULT false,
  calls_used integer DEFAULT 0,
  conversion_rate numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE weekly_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_sms ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access" ON weekly_briefings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON outreach_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON outreach_calls FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON outreach_sms FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON outreach_scripts FOR ALL TO authenticated USING (true) WITH CHECK (true)