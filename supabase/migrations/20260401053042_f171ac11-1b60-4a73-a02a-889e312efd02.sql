
CREATE TABLE IF NOT EXISTS ut_vendor_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID,
  vendor_name TEXT NOT NULL,
  vendor_type TEXT,
  amount_owed DECIMAL NOT NULL,
  event_date DATE,
  status TEXT DEFAULT 'held',
  released_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ut_revenue_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  event_revenue DECIMAL DEFAULT 0,
  shop_revenue DECIMAL DEFAULT 0,
  kit_revenue DECIMAL DEFAULT 0,
  total_gross DECIMAL DEFAULT 0,
  ambassador_payouts DECIMAL DEFAULT 0,
  vendor_payouts DECIMAL DEFAULT 0,
  net_profit DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ut_ai_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  data_context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ut_vendor_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ut_revenue_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ut_ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth all vendor_payments" ON ut_vendor_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth all revenue_snapshots" ON ut_revenue_snapshots FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth all ai_conversations" ON ut_ai_conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);
