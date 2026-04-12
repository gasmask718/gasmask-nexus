
-- tt_pricing_rules
CREATE TABLE IF NOT EXISTS public.tt_pricing_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_category text NOT NULL,
  vehicle_id uuid REFERENCES public.tt_vehicles(id),
  base_rate numeric(10,2) NOT NULL,
  per_mile_rate numeric(10,2) NOT NULL,
  minimum_fare numeric(10,2) NOT NULL,
  per_hour_rate numeric(10,2),
  surge_multiplier numeric(4,2) DEFAULT 1.0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.tt_pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access on tt_pricing_rules" ON public.tt_pricing_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- tt_dispatches
CREATE TABLE IF NOT EXISTS public.tt_dispatches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid REFERENCES public.tt_bookings(id),
  driver_id uuid REFERENCES public.tt_drivers(id),
  vehicle_id uuid REFERENCES public.tt_vehicles(id),
  assigned_at timestamptz,
  driver_en_route_at timestamptz,
  driver_arrived_at timestamptz,
  ride_started_at timestamptz,
  ride_completed_at timestamptz,
  pickup_eta_minutes integer,
  status text DEFAULT 'pending',
  dispatch_notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.tt_dispatches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access on tt_dispatches" ON public.tt_dispatches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- tt_driver_availability
CREATE TABLE IF NOT EXISTS public.tt_driver_availability (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id uuid REFERENCES public.tt_drivers(id),
  available_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_available boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.tt_driver_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access on tt_driver_availability" ON public.tt_driver_availability FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- tt_vehicle_maintenance
CREATE TABLE IF NOT EXISTS public.tt_vehicle_maintenance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id uuid REFERENCES public.tt_vehicles(id),
  service_type text NOT NULL,
  service_date date NOT NULL,
  next_service_date date,
  mileage_at_service integer,
  cost numeric(10,2),
  vendor text,
  notes text,
  status text DEFAULT 'scheduled',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.tt_vehicle_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access on tt_vehicle_maintenance" ON public.tt_vehicle_maintenance FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- tt_customer_reviews
CREATE TABLE IF NOT EXISTS public.tt_customer_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid REFERENCES public.tt_bookings(id),
  customer_name text NOT NULL,
  customer_email text,
  driver_id uuid REFERENCES public.tt_drivers(id),
  vehicle_id uuid REFERENCES public.tt_vehicles(id),
  rating integer CHECK (rating BETWEEN 1 AND 5),
  review_text text,
  service_type text,
  verified boolean DEFAULT false,
  is_featured boolean DEFAULT false,
  response_text text,
  responded_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.tt_customer_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access on tt_customer_reviews" ON public.tt_customer_reviews FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- tt_corporate_accounts
CREATE TABLE IF NOT EXISTS public.tt_corporate_accounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  billing_email text,
  credit_limit numeric(10,2) DEFAULT 0,
  current_balance numeric(10,2) DEFAULT 0,
  payment_terms text DEFAULT 'net_30',
  account_status text DEFAULT 'pending',
  contract_start_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.tt_corporate_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access on tt_corporate_accounts" ON public.tt_corporate_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- tt_notifications_log
CREATE TABLE IF NOT EXISTS public.tt_notifications_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid REFERENCES public.tt_bookings(id),
  type text NOT NULL,
  channel text NOT NULL,
  recipient text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'sent',
  sent_at timestamptz DEFAULT now(),
  error_message text
);
ALTER TABLE public.tt_notifications_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access on tt_notifications_log" ON public.tt_notifications_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add missing columns to tt_bookings for dispatch flow
ALTER TABLE public.tt_bookings ADD COLUMN IF NOT EXISTS booking_reference text;
ALTER TABLE public.tt_bookings ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES public.tt_drivers(id);
ALTER TABLE public.tt_bookings ADD COLUMN IF NOT EXISTS pickup_location text;
ALTER TABLE public.tt_bookings ADD COLUMN IF NOT EXISTS dropoff_location text;
ALTER TABLE public.tt_bookings ADD COLUMN IF NOT EXISTS pickup_lat numeric;
ALTER TABLE public.tt_bookings ADD COLUMN IF NOT EXISTS pickup_lng numeric;
ALTER TABLE public.tt_bookings ADD COLUMN IF NOT EXISTS dropoff_lat numeric;
ALTER TABLE public.tt_bookings ADD COLUMN IF NOT EXISTS dropoff_lng numeric;
ALTER TABLE public.tt_bookings ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';

-- Enable realtime on new tables (tt_bookings already has it)
ALTER PUBLICATION supabase_realtime ADD TABLE public.tt_dispatches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tt_drivers;
