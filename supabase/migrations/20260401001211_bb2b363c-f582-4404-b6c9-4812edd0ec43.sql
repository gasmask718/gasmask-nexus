
-- OUTREACH CAMPAIGNS
CREATE TABLE IF NOT EXISTS ut_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  audience_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  target_cities TEXT[] DEFAULT '{}',
  daily_limit INTEGER DEFAULT 50,
  total_sent INTEGER DEFAULT 0,
  total_responses INTEGER DEFAULT 0,
  total_conversions INTEGER DEFAULT 0,
  message_template TEXT,
  email_subject TEXT,
  email_template TEXT,
  sequence_days INTEGER[] DEFAULT '{1,3,7}',
  is_automated BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- OUTREACH LOG
CREATE TABLE IF NOT EXISTS ut_outreach_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES ut_campaigns(id),
  prospect_id UUID,
  prospect_table TEXT,
  channel TEXT NOT NULL,
  to_number TEXT,
  to_email TEXT,
  to_instagram TEXT,
  message_sent TEXT,
  subject_sent TEXT,
  status TEXT DEFAULT 'sent',
  twilio_sid TEXT,
  sendgrid_id TEXT,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AUTOMATION SCHEDULE
CREATE TABLE IF NOT EXISTS ut_automation_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name TEXT NOT NULL UNIQUE,
  audience_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  run_time_est TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  last_run_count INTEGER DEFAULT 0,
  total_runs INTEGER DEFAULT 0,
  total_outreach_sent INTEGER DEFAULT 0,
  api_required TEXT,
  api_connected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DAILY GROWTH REPORT
CREATE TABLE IF NOT EXISTS ut_growth_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_date DATE NOT NULL UNIQUE,
  venues_found INTEGER DEFAULT 0,
  staff_found INTEGER DEFAULT 0,
  ambassadors_found INTEGER DEFAULT 0,
  business_owners_found INTEGER DEFAULT 0,
  customers_found INTEGER DEFAULT 0,
  sms_sent INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  calls_made INTEGER DEFAULT 0,
  dms_queued INTEGER DEFAULT 0,
  responses_received INTEGER DEFAULT 0,
  new_signups INTEGER DEFAULT 0,
  new_bookings INTEGER DEFAULT 0,
  revenue_generated DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE ut_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ut_outreach_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ut_automation_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE ut_growth_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read campaigns" ON ut_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth all campaigns" ON ut_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth read outreach_log" ON ut_outreach_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth all outreach_log" ON ut_outreach_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth read schedule" ON ut_automation_schedule FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth all schedule" ON ut_automation_schedule FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth read reports" ON ut_growth_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth all reports" ON ut_growth_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- SEED AUTOMATION SCHEDULE
INSERT INTO ut_automation_schedule 
(job_name, audience_type, channel, cron_expression, run_time_est, api_required, api_connected)
VALUES
('venue_scrape_daily', 'venue', 'sms', '0 7 * * *', '2:00 AM EST', 'outscraper', false),
('staff_scrape_daily', 'staff', 'sms', '30 7 * * *', '2:30 AM EST', 'outscraper', false),
('ambassador_search_daily', 'ambassador', 'instagram_dm', '0 8 * * *', '3:00 AM EST', 'phantombuster', false),
('party_owner_outreach', 'party_business_owner', 'email', '30 8 * * *', '3:30 AM EST', 'apollo', false),
('customer_acquisition', 'direct_customer', 'email', '0 9 * * *', '4:00 AM EST', 'sendgrid', false),
('sms_followup_sequence', 'all', 'sms', '0 14 * * *', '9:00 AM EST', 'twilio', true),
('email_sequence_day3', 'all', 'email', '0 15 * * *', '10:00 AM EST', 'sendgrid', false),
('daily_growth_report', 'all', 'sms', '0 11 * * *', '6:00 AM EST', 'twilio', true),
('cold_call_campaign', 'venue', 'call', '0 16 * * *', '11:00 AM EST', 'twilio', true)
ON CONFLICT (job_name) DO NOTHING;

-- SEED CAMPAIGNS
INSERT INTO ut_campaigns
(name, audience_type, channel, target_cities, daily_limit, message_template, email_subject, email_template)
VALUES
('Venue Partner SMS Outreach', 'venue', 'sms',
 ARRAY['Brooklyn','Bronx','Queens','Newark','Atlanta','Miami','Philadelphia'],
 50,
 'Hi [name]! Unforgettable Times is the fastest growing event platform in [city]. We''d love to feature [business] and drive bookings your way — zero upfront cost. Interested? unforgettable-times.com/join',
 NULL, NULL),
('Staff Recruitment SMS', 'staff', 'sms',
 ARRAY['Brooklyn','Bronx','Queens','Newark','Atlanta','Miami','Philadelphia'],
 100,
 'Hey [name]! Unforgettable Times is hiring event staff in [city]. Flexible hours, $25-45/hr, weekly pay. DJs, photographers, caterers welcome! Apply: unforgettable-times.com/join',
 NULL, NULL),
('Ambassador Instagram DM', 'ambassador', 'instagram_dm',
 ARRAY['New York','New Jersey','Atlanta','Miami','Philadelphia'],
 50,
 'Hey [name]! Your [city] content is 🔥 We''re building our ambassador team at Unforgettable Times. Earn 15-25% per booking! Interested? unforgettable-times.com/ambassador',
 NULL, NULL),
('Party Business Owner Email', 'party_business_owner', 'email',
 ARRAY['New York','New Jersey','Atlanta','Miami','Philadelphia'],
 100, NULL,
 'Start Your Own Event Business — Powered by Unforgettable Times',
 'Hi [name], Have you ever thought about starting your own event planning business? Unforgettable Times provides everything you need — platform, clients, staff, venues — already built. You just run the business under our umbrella. Zero startup cost. Apply: unforgettable-times.com/join'),
('Direct Customer Acquisition', 'direct_customer', 'email',
 ARRAY['New York','New Jersey','Atlanta','Miami','Philadelphia'],
 200, NULL,
 'Plan Your Dream Event in [city] — AI-Powered',
 'Hi [name], Planning an event in [city]? Unforgettable Times uses AI to create your perfect event plan in 60 seconds — venues, staff, catering all matched to your budget. Try it free: unforgettable-times.com/plan')
ON CONFLICT DO NOTHING;
