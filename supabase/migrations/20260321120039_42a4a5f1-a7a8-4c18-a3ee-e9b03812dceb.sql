-- Phone type detection columns
ALTER TABLE store_master
  ADD COLUMN IF NOT EXISTS phone_type text,
  ADD COLUMN IF NOT EXISTS sms_capable boolean,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

ALTER TABLE outreach_leads
  ADD COLUMN IF NOT EXISTS phone_type text,
  ADD COLUMN IF NOT EXISTS sms_capable boolean,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

-- Enable realtime on outreach_sms
ALTER PUBLICATION supabase_realtime ADD TABLE outreach_sms;