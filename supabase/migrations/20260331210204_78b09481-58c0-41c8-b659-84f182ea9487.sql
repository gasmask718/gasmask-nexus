CREATE TABLE IF NOT EXISTS ut_event_bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  event_type TEXT,
  event_date DATE,
  city TEXT,
  guest_count INTEGER,
  budget TEXT,
  preferences TEXT,
  package_name TEXT,
  full_price DECIMAL DEFAULT 0,
  deposit_amount DECIMAL DEFAULT 0,
  deposit_paid BOOLEAN DEFAULT false,
  stripe_payment_intent_id TEXT,
  ai_plan JSONB,
  status TEXT DEFAULT 'pending_payment',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ut_event_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read bookings"
ON ut_event_bookings FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Service role can insert bookings"
ON ut_event_bookings FOR INSERT
TO service_role WITH CHECK (true);

CREATE POLICY "Service role can update bookings"
ON ut_event_bookings FOR UPDATE
TO service_role USING (true);