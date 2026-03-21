
-- Brandaro phone number library
CREATE TABLE IF NOT EXISTS brandaro_phone_numbers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL UNIQUE,
  friendly_name TEXT NOT NULL,
  description TEXT,
  purpose TEXT,
  brand TEXT DEFAULT 'Brandaro',
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  twilio_sid TEXT,
  capabilities JSONB DEFAULT '{"sms": true, "voice": true, "mms": false}',
  monthly_cost NUMERIC(6,2) DEFAULT 1.15,
  date_purchased DATE,
  assigned_campaign TEXT,
  messages_sent INTEGER DEFAULT 0,
  messages_received INTEGER DEFAULT 0,
  calls_made INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one default per brand
CREATE UNIQUE INDEX IF NOT EXISTS idx_brandaro_phone_default
ON brandaro_phone_numbers (brand) WHERE is_default = TRUE;

-- RLS
ALTER TABLE brandaro_phone_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_phones" ON brandaro_phone_numbers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "auth_read_phones" ON brandaro_phone_numbers FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_phones" ON brandaro_phone_numbers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_phones" ON brandaro_phone_numbers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_phones" ON brandaro_phone_numbers FOR DELETE TO authenticated USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE brandaro_phone_numbers;

-- Increment functions
CREATE OR REPLACE FUNCTION increment_sent(num TEXT)
RETURNS INTEGER AS $$
  UPDATE brandaro_phone_numbers
  SET messages_sent = COALESCE(messages_sent, 0) + 1
  WHERE phone_number = num
  RETURNING messages_sent;
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION increment_received(num TEXT)
RETURNS INTEGER AS $$
  UPDATE brandaro_phone_numbers
  SET messages_received = COALESCE(messages_received, 0) + 1
  WHERE phone_number = num
  RETURNING messages_received;
$$ LANGUAGE SQL;
