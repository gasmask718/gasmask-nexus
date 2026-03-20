
-- Add SMS conversation log columns to existing brandaro_conversations
ALTER TABLE brandaro_conversations
ADD COLUMN IF NOT EXISTS message_body TEXT,
ADD COLUMN IF NOT EXISTS from_number TEXT,
ADD COLUMN IF NOT EXISTS to_number TEXT,
ADD COLUMN IF NOT EXISTS twilio_message_sid TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'received';

-- Create index for lead lookups
CREATE INDEX IF NOT EXISTS idx_brandaro_conv_lead_id ON brandaro_conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_brandaro_conv_created ON brandaro_conversations(created_at DESC);

-- Intent log table
CREATE TABLE IF NOT EXISTS brandaro_intent_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES brandaro_qualified_leads(id) ON DELETE CASCADE,
  message_text TEXT,
  intent TEXT,
  intent_score INTEGER,
  suggested_stage TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE brandaro_intent_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_intent_log" ON brandaro_intent_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_intent_log" ON brandaro_intent_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "anon_read_intent_log" ON brandaro_intent_log FOR SELECT TO anon USING (true);

-- Add missing columns to leads table
ALTER TABLE brandaro_qualified_leads
ADD COLUMN IF NOT EXISTS last_reply_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_reply_text TEXT,
ADD COLUMN IF NOT EXISTS sms_count INTEGER DEFAULT 0;

-- RLS for conversations - add insert policy for service_role
CREATE POLICY "service_role_full_conversations" ON brandaro_conversations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Anon read for conversations (for webhook testing without auth)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_read_conversations' AND tablename = 'brandaro_conversations') THEN
    CREATE POLICY "anon_read_conversations" ON brandaro_conversations FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- Anon insert for conversations (webhook inserts as service_role but just in case)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_insert_conversations' AND tablename = 'brandaro_conversations') THEN
    CREATE POLICY "anon_insert_conversations" ON brandaro_conversations FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;
