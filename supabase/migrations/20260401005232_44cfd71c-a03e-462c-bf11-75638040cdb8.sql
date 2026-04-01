
-- Vendor pricing (what they charge us)
CREATE TABLE IF NOT EXISTS ut_vendor_pricing (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID,
  vendor_type TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  service_name TEXT NOT NULL,
  base_cost DECIMAL NOT NULL,
  markup_percent DECIMAL NOT NULL,
  customer_price DECIMAL GENERATED ALWAYS AS (ROUND(base_cost * (1 + markup_percent/100), 2)) STORED,
  our_profit DECIMAL GENERATED ALWAYS AS (ROUND(base_cost * (markup_percent/100), 2)) STORED,
  unit TEXT DEFAULT 'per_event',
  min_hours INTEGER DEFAULT 1,
  max_hours INTEGER,
  city TEXT,
  state TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event packages (bundled services)
CREATE TABLE IF NOT EXISTS ut_event_packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  package_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  description TEXT,
  city TEXT,
  state TEXT,
  items JSONB DEFAULT '[]',
  total_vendor_cost DECIMAL DEFAULT 0,
  total_customer_price DECIMAL DEFAULT 0,
  total_our_profit DECIMAL DEFAULT 0,
  our_margin_percent DECIMAL DEFAULT 0,
  ambassador_commission_starter DECIMAL DEFAULT 0,
  ambassador_commission_silver DECIMAL DEFAULT 0,
  ambassador_commission_gold DECIMAL DEFAULT 0,
  ambassador_commission_platinum DECIMAL DEFAULT 0,
  ambassador_commission_legend DECIMAL DEFAULT 0,
  net_profit_starter DECIMAL DEFAULT 0,
  net_profit_legend DECIMAL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer quotes
CREATE TABLE IF NOT EXISTS ut_quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_number TEXT UNIQUE,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  event_type TEXT,
  event_date DATE,
  city TEXT,
  state TEXT,
  guest_count INTEGER,
  package_id UUID REFERENCES ut_event_packages(id),
  custom_items JSONB DEFAULT '[]',
  subtotal DECIMAL DEFAULT 0,
  discount_percent DECIMAL DEFAULT 0,
  discount_amount DECIMAL DEFAULT 0,
  total_customer_price DECIMAL DEFAULT 0,
  total_vendor_cost DECIMAL DEFAULT 0,
  total_our_profit DECIMAL DEFAULT 0,
  our_margin_percent DECIMAL DEFAULT 0,
  referral_code TEXT,
  ambassador_id UUID,
  ambassador_commission_rate DECIMAL DEFAULT 10,
  ambassador_commission_amount DECIMAL DEFAULT 0,
  net_profit DECIMAL DEFAULT 0,
  status TEXT DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE ut_vendor_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE ut_event_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ut_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth all vendor_pricing" ON ut_vendor_pricing FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth all event_packages" ON ut_event_packages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth all quotes" ON ut_quotes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add profit fields to event bookings
ALTER TABLE ut_event_bookings
ADD COLUMN IF NOT EXISTS vendor_cost DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS gross_profit DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_profit DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS margin_percent DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS package_id UUID,
ADD COLUMN IF NOT EXISTS quote_id UUID;

-- Seed vendor pricing
INSERT INTO ut_vendor_pricing
(vendor_type, vendor_name, service_name, base_cost, markup_percent, unit, city, state)
VALUES
('venue', 'Grand Luxe Ballroom', 'Full Venue Rental', 800, 40, 'per_event', 'Brooklyn', 'NY'),
('venue', 'Elite Events Center', 'Full Venue Rental', 600, 40, 'per_event', 'Bronx', 'NY'),
('venue', 'Royal Garden Venue', 'Full Venue Rental', 700, 40, 'per_event', 'Queens', 'NY'),
('dj', 'DJ Pharaoh', 'DJ Services 4hr', 400, 50, 'per_event', 'Brooklyn', 'NY'),
('photographer', 'Lens King Photography', 'Event Photography 4hr', 500, 50, 'per_event', 'Newark', 'NJ'),
('caterer', 'Chef Royal Catering', 'Caribbean Buffet per person', 35, 50, 'per_person', 'Harlem', 'NY'),
('decorator', 'Elite Decor Co', 'Full Room Decoration', 300, 50, 'per_event', 'Brooklyn', 'NY'),
('coordinator', 'Unforgettable Times', 'Event Coordinator', 200, 50, 'per_event', 'New York', 'NY');
