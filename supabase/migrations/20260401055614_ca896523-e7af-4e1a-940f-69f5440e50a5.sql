
CREATE TABLE IF NOT EXISTS ut_supplier_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID REFERENCES ut_suppliers(id),
  rfq_id UUID REFERENCES ut_rfq_requests(id),
  channel TEXT NOT NULL DEFAULT 'email',
  message TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'sent',
  attachment_url TEXT,
  read_status BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ut_shipping_quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID,
  rfq_id UUID REFERENCES ut_rfq_requests(id),
  method TEXT NOT NULL,
  cost DECIMAL,
  days INTEGER,
  forwarder_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
