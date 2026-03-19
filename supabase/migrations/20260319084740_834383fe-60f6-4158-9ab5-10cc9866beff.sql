DROP FUNCTION IF EXISTS normalize_phone(text);

CREATE OR REPLACE FUNCTION normalize_phone(raw_phone TEXT)
RETURNS TEXT AS $$
DECLARE
  digits TEXT;
BEGIN
  digits := regexp_replace(raw_phone, '[^0-9]', '', 'g');
  IF length(digits) = 10 THEN
    digits := '1' || digits;
  END IF;
  IF length(digits) = 11 AND left(digits, 1) = '1' THEN
    RETURN '+' || digits;
  END IF;
  RETURN '+' || digits;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE brandaro_qualified_leads
ADD COLUMN IF NOT EXISTS converted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS revenue_amount NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS conversion_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS demo_url TEXT,
ADD COLUMN IF NOT EXISTS service_interest TEXT,
ADD COLUMN IF NOT EXISTS stripe_payment_link TEXT,
ADD COLUMN IF NOT EXISTS ai_paused BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS brandaro_payment_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  stripe_price_id TEXT,
  stripe_payment_link_url TEXT,
  service_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brandaro_pending_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES brandaro_qualified_leads(id),
  lead_name TEXT,
  phone_number TEXT,
  message_body TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('sms', 'pitch', 'objection_response', 'followup')),
  ai_agent TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'sent', 'rejected', 'edited')),
  objection_responses JSONB,
  intent_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pending_messages_status ON brandaro_pending_messages(status) WHERE status = 'pending';