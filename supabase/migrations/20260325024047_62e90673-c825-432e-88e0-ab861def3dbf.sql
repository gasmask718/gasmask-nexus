
CREATE TABLE IF NOT EXISTS dc_leads (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name   TEXT NOT NULL,
  first_name      TEXT,
  last_name       TEXT,
  phone           TEXT NOT NULL,
  email           TEXT,
  address         TEXT,
  city            TEXT,
  state           TEXT,
  zip             TEXT,
  lead_type       TEXT,
  lead_source     TEXT DEFAULT 'manual_upload',
  status          TEXT DEFAULT 'new',
  notes           TEXT,
  call_count      INTEGER DEFAULT 0,
  last_called_at  TIMESTAMPTZ,
  outcome         TEXT,
  campaign_id     UUID,
  external_ref_id TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dc_leads_business ON dc_leads(business_name);
CREATE INDEX IF NOT EXISTS idx_dc_leads_status ON dc_leads(status);
CREATE INDEX IF NOT EXISTS idx_dc_leads_phone ON dc_leads(phone);
CREATE INDEX IF NOT EXISTS idx_dc_leads_campaign ON dc_leads(campaign_id);
