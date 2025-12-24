-- DELIVERY & LOGISTICS - CORE TABLES

-- TABLE: drivers
CREATE TABLE public.drivers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id),
  full_name text NOT NULL,
  phone text,
  email text,
  vehicle_type text,
  license_number text,
  home_base text,
  status text NOT NULL DEFAULT 'active',
  payout_method text,
  payout_handle text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drivers_select" ON public.drivers FOR SELECT USING (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid()));
CREATE POLICY "drivers_all" ON public.drivers FOR ALL USING (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- TABLE: bikers
CREATE TABLE public.bikers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id),
  full_name text NOT NULL,
  phone text,
  email text,
  territory text,
  status text NOT NULL DEFAULT 'active',
  payout_method text,
  payout_handle text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bikers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bikers_select" ON public.bikers FOR SELECT USING (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid()));
CREATE POLICY "bikers_all" ON public.bikers FOR ALL USING (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- TABLE: locations
CREATE TABLE public.locations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  location_type text NOT NULL DEFAULT 'store',
  name text NOT NULL,
  address_line1 text,
  city text,
  state text,
  zip text,
  lat numeric,
  lng numeric,
  contact_name text,
  contact_phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "locations_select" ON public.locations FOR SELECT USING (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid()));
CREATE POLICY "locations_all" ON public.locations FOR ALL USING (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- TABLE: deliveries
CREATE TABLE public.deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  delivery_type text NOT NULL DEFAULT 'restock',
  created_by_user_id uuid REFERENCES public.profiles(id),
  scheduled_date date NOT NULL DEFAULT CURRENT_DATE,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'draft',
  assigned_driver_id uuid REFERENCES public.drivers(id),
  dispatcher_notes text,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deliveries_select" ON public.deliveries FOR SELECT USING (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid()));
CREATE POLICY "deliveries_all" ON public.deliveries FOR ALL USING (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- TABLE: delivery_stops
CREATE TABLE public.delivery_stops (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  stop_order integer NOT NULL DEFAULT 1,
  location_id uuid REFERENCES public.locations(id),
  stop_type text NOT NULL DEFAULT 'dropoff',
  window_start time,
  window_end time,
  items_summary text,
  amount_due numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  driver_notes text,
  completion_time timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stops_select" ON public.delivery_stops FOR SELECT USING (delivery_id IN (SELECT id FROM public.deliveries WHERE business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid())));

-- TABLE: proofs
CREATE TABLE public.proofs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  related_type text NOT NULL,
  related_id uuid NOT NULL,
  proof_type text NOT NULL,
  file_url text,
  text_note text,
  captured_by_user_id uuid REFERENCES public.profiles(id),
  captured_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proofs_select" ON public.proofs FOR SELECT USING (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid()));

-- TABLE: store_checks
CREATE TABLE public.store_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  assigned_biker_id uuid REFERENCES public.bikers(id),
  location_id uuid REFERENCES public.locations(id),
  check_type text NOT NULL DEFAULT 'inventory_check',
  scheduled_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'assigned',
  summary_notes text,
  created_by_user_id uuid REFERENCES public.profiles(id),
  reviewed_by_user_id uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.store_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checks_select" ON public.store_checks FOR SELECT USING (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid()));

-- TABLE: delivery_activity_log
CREATE TABLE public.delivery_activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  metadata_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_select" ON public.delivery_activity_log FOR SELECT USING (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid()));
CREATE POLICY "activity_insert" ON public.delivery_activity_log FOR INSERT WITH CHECK (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX idx_drivers_business ON public.drivers(business_id);
CREATE INDEX idx_deliveries_business ON public.deliveries(business_id);
CREATE INDEX idx_deliveries_date ON public.deliveries(scheduled_date);