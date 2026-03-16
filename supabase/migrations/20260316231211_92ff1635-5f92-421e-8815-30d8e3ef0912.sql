
-- Add automation fields to brandaro_demo_sites
ALTER TABLE brandaro_demo_sites 
  ADD COLUMN IF NOT EXISTS slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS public_status text DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS published_version int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS durable_job_status text,
  ADD COLUMN IF NOT EXISTS durable_last_error text,
  ADD COLUMN IF NOT EXISTS durable_generated_url text,
  ADD COLUMN IF NOT EXISTS durable_screenshot_url text;

-- Add engagement_score to qualified leads
ALTER TABLE brandaro_qualified_leads 
  ADD COLUMN IF NOT EXISTS engagement_score int DEFAULT 0;

-- Add fields to brandaro_proposals
ALTER TABLE brandaro_proposals 
  ADD COLUMN IF NOT EXISTS stripe_checkout_id text,
  ADD COLUMN IF NOT EXISTS stripe_session_url text,
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_amount numeric(10,2);

-- Add fields to brandaro_clients
ALTER TABLE brandaro_clients 
  ADD COLUMN IF NOT EXISTS proposal_id uuid REFERENCES brandaro_proposals(id),
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES brandaro_qualified_leads(id),
  ADD COLUMN IF NOT EXISTS onboarding_checklist jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS portal_access_enabled boolean DEFAULT false;

-- Add fields to brandaro_projects
ALTER TABLE brandaro_projects 
  ADD COLUMN IF NOT EXISTS assigned_builder text,
  ADD COLUMN IF NOT EXISTS demo_id uuid REFERENCES brandaro_demo_sites(id);

-- Add fields to brandaro_subscriptions
ALTER TABLE brandaro_subscriptions 
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Message log for all outbound communications
CREATE TABLE IF NOT EXISTS brandaro_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES brandaro_qualified_leads(id),
  demo_id uuid REFERENCES brandaro_demo_sites(id),
  proposal_id uuid REFERENCES brandaro_proposals(id),
  channel text NOT NULL DEFAULT 'sms',
  provider text,
  destination text NOT NULL,
  message_body text,
  send_status text NOT NULL DEFAULT 'queued',
  provider_message_id text,
  failure_reason text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE brandaro_message_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_users_manage_message_log" ON brandaro_message_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Job failures tracking
CREATE TABLE IF NOT EXISTS brandaro_job_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  attempt_count int DEFAULT 1,
  last_error text,
  status text DEFAULT 'pending_retry',
  retry_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE brandaro_job_failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_users_manage_job_failures" ON brandaro_job_failures FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Claude agent tasks
CREATE TABLE IF NOT EXISTS brandaro_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type text NOT NULL,
  lead_id uuid REFERENCES brandaro_qualified_leads(id),
  client_id uuid REFERENCES brandaro_clients(id),
  project_id uuid REFERENCES brandaro_projects(id),
  assigned_to text DEFAULT 'human',
  prompt_payload jsonb,
  output_payload jsonb,
  review_status text DEFAULT 'pending',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE brandaro_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_users_manage_tasks" ON brandaro_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE brandaro_message_log;
ALTER PUBLICATION supabase_realtime ADD TABLE brandaro_job_failures;
