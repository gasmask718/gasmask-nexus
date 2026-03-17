
-- Section 5: Add priority_call to lead statuses & conversation tracking
-- Section 8: Enhance retry engine columns
-- Section 11: Production pipeline prep flags
-- Section 7: Conversation AI tracking

-- Add retry columns to brandaro_job_failures
ALTER TABLE brandaro_job_failures
  ADD COLUMN IF NOT EXISTS retry_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries int DEFAULT 4,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

-- Add production prep flags to brandaro_demo_sites
ALTER TABLE brandaro_demo_sites
  ADD COLUMN IF NOT EXISTS demo_ready_for_conversion boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS production_build_ready boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS content_blocks jsonb DEFAULT '[]'::jsonb;

-- Add payment_status to brandaro_proposals if not exists
ALTER TABLE brandaro_proposals
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_amount numeric,
  ADD COLUMN IF NOT EXISTS stripe_checkout_id text,
  ADD COLUMN IF NOT EXISTS stripe_session_url text;

-- Conversation AI tracking table
CREATE TABLE IF NOT EXISTS brandaro_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES brandaro_qualified_leads(id) ON DELETE CASCADE NOT NULL,
  direction text NOT NULL DEFAULT 'inbound',
  message_text text NOT NULL,
  objection_type text,
  ai_response text,
  response_effectiveness text,
  channel text DEFAULT 'sms',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE brandaro_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_manage_conversations" ON brandaro_conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Nightly discovery log
CREATE TABLE IF NOT EXISTS brandaro_nightly_discovery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date date NOT NULL DEFAULT CURRENT_DATE,
  status text DEFAULT 'pending',
  leads_found int DEFAULT 0,
  sources_queried jsonb DEFAULT '[]'::jsonb,
  errors jsonb DEFAULT '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE brandaro_nightly_discovery_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_manage_nightly_log" ON brandaro_nightly_discovery_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable realtime for conversations
ALTER PUBLICATION supabase_realtime ADD TABLE brandaro_conversations;
