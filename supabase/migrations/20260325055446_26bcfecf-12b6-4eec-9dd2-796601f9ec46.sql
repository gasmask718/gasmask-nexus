
-- Automation log table
CREATE TABLE IF NOT EXISTS re_automation_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_type TEXT NOT NULL,
  status TEXT DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  leads_processed INTEGER DEFAULT 0,
  leads_imported INTEGER DEFAULT 0,
  leads_skipped INTEGER DEFAULT 0,
  source TEXT,
  states TEXT[],
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Buyer blast log
CREATE TABLE IF NOT EXISTS re_buyer_blast_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID REFERENCES re_deals(id),
  buyer_id UUID REFERENCES re_buyers(id),
  channel TEXT CHECK (channel IN ('email','sms')),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent','delivered','opened','clicked','replied','bounced')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Add docusign fields to re_leads
ALTER TABLE re_leads ADD COLUMN IF NOT EXISTS docusign_envelope_id TEXT;
ALTER TABLE re_leads ADD COLUMN IF NOT EXISTS contract_sent_at TIMESTAMPTZ;
ALTER TABLE re_leads ADD COLUMN IF NOT EXISTS contract_signed_at TIMESTAMPTZ;

-- Add deal_sheet_url to re_deals
ALTER TABLE re_deals ADD COLUMN IF NOT EXISTS deal_sheet_url TEXT;
ALTER TABLE re_deals ADD COLUMN IF NOT EXISTS docusign_envelope_id TEXT;

-- Add re_lead_id to dc_leads for cross-reference
ALTER TABLE dc_leads ADD COLUMN IF NOT EXISTS re_lead_id UUID;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_re_auto_log_type ON re_automation_log(automation_type);
CREATE INDEX IF NOT EXISTS idx_re_blast_deal ON re_buyer_blast_log(deal_id);

-- Enable pg_net for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- RLS
ALTER TABLE re_automation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_buyer_blast_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view automation logs" ON re_automation_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert automation logs" ON re_automation_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can view blast logs" ON re_buyer_blast_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert blast logs" ON re_buyer_blast_log FOR INSERT TO authenticated WITH CHECK (true);
