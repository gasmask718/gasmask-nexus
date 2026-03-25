
-- Surplus Funds OS tables

CREATE TABLE IF NOT EXISTS surplus_funds_leads (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name       TEXT,
  last_name        TEXT,
  phone            TEXT,
  email            TEXT,
  address          TEXT,
  city             TEXT,
  state            TEXT,
  zip              TEXT,
  county           TEXT NOT NULL,
  property_address TEXT,
  foreclosure_date DATE,
  sale_price       NUMERIC,
  amount_owed      NUMERIC,
  surplus_amount   NUMERIC,
  court_case_number TEXT,
  skip_traced      BOOLEAN DEFAULT false,
  status           TEXT DEFAULT 'new'
    CHECK (status IN (
      'new','skip_trace_pending','phone_found','queued',
      'called','interested','consultation_booked',
      'agreement_signed','referred_to_attorney',
      'case_filed','hearing_scheduled','approved',
      'funds_released','closed','do_not_contact')),
  call_count       INTEGER DEFAULT 0,
  last_called_at   TIMESTAMPTZ,
  call_outcome     TEXT,
  notes            TEXT,
  lead_source      TEXT DEFAULT 'manual_upload',
  assigned_attorney_id UUID,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS surplus_funds_cases (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id             UUID REFERENCES surplus_funds_leads(id),
  client_name         TEXT NOT NULL,
  client_phone        TEXT,
  client_email        TEXT,
  property_address    TEXT,
  county              TEXT,
  state               TEXT,
  court_case_number   TEXT,
  surplus_amount      NUMERIC NOT NULL,
  our_percentage      NUMERIC DEFAULT 35,
  our_expected_fee    NUMERIC GENERATED ALWAYS AS
    (surplus_amount * our_percentage / 100) STORED,
  attorney_id         UUID,
  attorney_name       TEXT,
  status              TEXT DEFAULT 'intake'
    CHECK (status IN (
      'intake','agreement_sent','agreement_signed',
      'referred','filed','hearing_scheduled',
      'approved','funds_released','paid','closed','lost')),
  agreement_signed_at TIMESTAMPTZ,
  filed_at            TIMESTAMPTZ,
  hearing_date        DATE,
  approved_at         TIMESTAMPTZ,
  funds_released_at   TIMESTAMPTZ,
  amount_received     NUMERIC,
  notes               TEXT,
  documents           JSONB DEFAULT '[]',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS surplus_funds_attorneys (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT NOT NULL,
  firm         TEXT,
  phone        TEXT,
  email        TEXT,
  states       TEXT[],
  fee_split    NUMERIC DEFAULT 35,
  cases_total  INTEGER DEFAULT 0,
  cases_won    INTEGER DEFAULT 0,
  status       TEXT DEFAULT 'active',
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sf_leads_status ON surplus_funds_leads(status);
CREATE INDEX IF NOT EXISTS idx_sf_leads_state  ON surplus_funds_leads(state);
CREATE INDEX IF NOT EXISTS idx_sf_cases_status ON surplus_funds_cases(status);

ALTER TABLE surplus_funds_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE surplus_funds_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE surplus_funds_attorneys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage surplus_funds_leads" ON surplus_funds_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage surplus_funds_cases" ON surplus_funds_cases FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage surplus_funds_attorneys" ON surplus_funds_attorneys FOR ALL TO authenticated USING (true) WITH CHECK (true);
