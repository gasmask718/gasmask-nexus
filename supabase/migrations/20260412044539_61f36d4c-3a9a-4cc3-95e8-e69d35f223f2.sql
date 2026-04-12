
CREATE TABLE IF NOT EXISTS tt_partner_assets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id text NOT NULL,
  partner_name text NOT NULL,
  partner_type text NOT NULL,
  asset_type text NOT NULL CHECK (asset_type IN ('vehicle', 'aircraft', 'vessel', 'team', 'individual')),
  asset_id text,
  asset_name text NOT NULL,
  asset_category text NOT NULL,
  asset_description text,
  capacity integer,
  base_rate numeric(10,2) DEFAULT 0,
  hourly_rate numeric(10,2) DEFAULT 0,
  daily_rate numeric(10,2) DEFAULT 0,
  markets text[] DEFAULT '{}',
  is_available boolean DEFAULT true,
  coverage_radius_miles integer DEFAULT 50,
  response_time_minutes integer DEFAULT 30,
  rating numeric(3,2) DEFAULT 5.00,
  total_jobs integer DEFAULT 0,
  photos text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tt_partner_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to tt_partner_assets"
  ON tt_partner_assets FOR ALL
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS tt_dispatch_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid REFERENCES tt_bookings(id),
  booking_reference text,
  service_type text NOT NULL,
  service_category text NOT NULL,
  pickup_location text,
  dropoff_location text,
  scheduled_at timestamptz,
  customer_name text,
  customer_phone text,
  special_requests text,
  total_price numeric(10,2),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'accepted', 'declined', 'expired', 'fulfilled', 'cancelled')),
  matched_partners jsonb DEFAULT '[]',
  accepted_partner_id text,
  accepted_partner_name text,
  sent_at timestamptz,
  accepted_at timestamptz,
  expires_at timestamptz,
  auto_matched boolean DEFAULT false,
  match_score numeric(5,2),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tt_dispatch_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to tt_dispatch_requests"
  ON tt_dispatch_requests FOR ALL
  USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE tt_dispatch_requests;
