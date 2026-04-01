
CREATE TABLE IF NOT EXISTS ut_rfq_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_name TEXT NOT NULL,
  product_category TEXT,
  target_quantity INTEGER,
  target_unit_price DECIMAL,
  needs_branding BOOLEAN DEFAULT true,
  logo_method TEXT,
  packaging_required BOOLEAN DEFAULT true,
  sample_required BOOLEAN DEFAULT true,
  destination_zip TEXT,
  urgency TEXT DEFAULT 'standard',
  status TEXT DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ut_rfq_supplier_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rfq_id UUID REFERENCES ut_rfq_requests(id),
  supplier_id UUID,
  supplier_name TEXT,
  unit_price DECIMAL,
  moq INTEGER,
  branding_cost DECIMAL,
  production_days INTEGER,
  shipping_method TEXT,
  shipping_cost DECIMAL,
  shipping_days INTEGER,
  total_landed_cost DECIMAL,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ut_shipments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID,
  supplier_name TEXT,
  product_name TEXT,
  quantity INTEGER,
  tracking_number TEXT,
  carrier TEXT,
  shipping_method TEXT,
  ship_date DATE,
  estimated_arrival DATE,
  actual_arrival DATE,
  status TEXT DEFAULT 'in_transit',
  customs_status TEXT,
  freight_forwarder TEXT,
  total_cost DECIMAL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
