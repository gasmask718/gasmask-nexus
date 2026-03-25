
CREATE TABLE IF NOT EXISTS re_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT, last_name TEXT, phone TEXT, email TEXT,
  property_address TEXT NOT NULL,
  city TEXT, state TEXT, zip TEXT, county TEXT,
  bedrooms INTEGER, bathrooms NUMERIC, sqft INTEGER,
  year_built INTEGER, lot_size TEXT,
  property_type TEXT DEFAULT 'SFR',
  condition TEXT CHECK (condition IN ('excellent','good','fair','poor','uninhabitable')),
  estimated_value NUMERIC, estimated_repairs NUMERIC DEFAULT 0,
  arv NUMERIC, asking_price NUMERIC, deal_score TEXT,
  equity_percentage NUMERIC, lead_type TEXT,
  motivation TEXT, timeline TEXT,
  skip_traced BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'new' CHECK (status IN (
    'new','skip_trace_pending','phone_found','queued',
    'called','interested','appointment_set','analyzed',
    'offer_made','countering','under_contract',
    'buyer_found','assigned','closed','dead','dnc')),
  call_count INTEGER DEFAULT 0,
  last_called_at TIMESTAMPTZ, call_outcome TEXT,
  assigned_va_id UUID, market_zone TEXT,
  lead_source TEXT DEFAULT 'propstream', notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS re_deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES re_leads(id),
  property_address TEXT NOT NULL,
  city TEXT, state TEXT, zip TEXT,
  property_type TEXT DEFAULT 'SFR',
  arv NUMERIC NOT NULL, purchase_price NUMERIC NOT NULL,
  estimated_repairs NUMERIC DEFAULT 0, mao NUMERIC,
  assignment_fee_target NUMERIC, assignment_fee_actual NUMERIC,
  seller_name TEXT, seller_phone TEXT,
  buyer_id UUID, buyer_name TEXT, buyer_email TEXT,
  status TEXT DEFAULT 'under_contract' CHECK (status IN (
    'under_contract','buyer_searching','buyer_found',
    'assignment_signed','title_opened',
    'closing_scheduled','closed','cancelled','expired')),
  contract_date DATE, close_date_target DATE,
  close_date_actual DATE, earnest_money NUMERIC DEFAULT 0,
  title_company TEXT, deal_score TEXT,
  comps JSONB DEFAULT '[]', documents JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS re_buyers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, company TEXT,
  phone TEXT, email TEXT,
  buyer_type TEXT CHECK (buyer_type IN (
    'hedge_fund','private_equity','iBuyer',
    'flipper','landlord','developer','other')),
  states TEXT[], buy_box_min NUMERIC, buy_box_max NUMERIC,
  property_types TEXT[], arv_percentage NUMERIC DEFAULT 75,
  avg_close_days INTEGER DEFAULT 21,
  deals_total INTEGER DEFAULT 0, deals_closed INTEGER DEFAULT 0,
  last_deal_date DATE, status TEXT DEFAULT 'active', notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS re_va_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, email TEXT, phone TEXT,
  role TEXT CHECK (role IN (
    'acquisition','disposition','lead_manager','transaction')),
  assigned_markets TEXT[],
  calls_today INTEGER DEFAULT 0,
  contracts_mtd INTEGER DEFAULT 0,
  revenue_mtd NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_re_leads_status ON re_leads(status);
CREATE INDEX IF NOT EXISTS idx_re_leads_state ON re_leads(state);
CREATE INDEX IF NOT EXISTS idx_re_leads_score ON re_leads(deal_score);
CREATE INDEX IF NOT EXISTS idx_re_deals_status ON re_deals(status);

ALTER TABLE re_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_va_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage re_leads" ON re_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage re_deals" ON re_deals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage re_buyers" ON re_buyers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage re_va_profiles" ON re_va_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
