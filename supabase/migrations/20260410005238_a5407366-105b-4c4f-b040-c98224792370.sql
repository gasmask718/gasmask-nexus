
-- ============================================
-- 1. REVENUE EVENTS (DRO)
-- ============================================
CREATE TABLE public.revenue_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID,
  event_type TEXT NOT NULL,
  source_system TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  actor_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.revenue_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_revenue_events" ON public.revenue_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_revenue_events" ON public.revenue_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX idx_dro_revenue_events_lead ON public.revenue_events(lead_id);
CREATE INDEX idx_dro_revenue_events_type ON public.revenue_events(event_type);
CREATE INDEX idx_dro_revenue_events_source ON public.revenue_events(source_system);

-- ============================================
-- 2. HELICOPTER PARTNERS
-- ============================================
CREATE TABLE public.helicopter_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT,
  contact_method TEXT,
  availability_notes TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.helicopter_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_heli_partners" ON public.helicopter_partners FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_heli_partners" ON public.helicopter_partners FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.helicopter_partner_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID,
  partner_id UUID REFERENCES public.helicopter_partners(id) ON DELETE SET NULL,
  requested_time TIMESTAMPTZ,
  suggested_time TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  response_time TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.helicopter_partner_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_heli_requests" ON public.helicopter_partner_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_heli_requests" ON public.helicopter_partner_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 3. YACHT & BOAT ENGINE (13 tables)
-- ============================================

CREATE TABLE public.yacht_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'US',
  marina_name TEXT,
  service_areas TEXT[],
  partner_type TEXT DEFAULT 'owner',
  accepts_api_requests BOOLEAN DEFAULT false,
  accepts_manual_requests BOOLEAN DEFAULT true,
  average_response_minutes INTEGER,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.yacht_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_yacht_partners" ON public.yacht_partners FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_yacht_partners" ON public.yacht_partners FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.yacht_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID REFERENCES public.yacht_partners(id) ON DELETE CASCADE,
  vessel_name TEXT NOT NULL,
  vessel_type TEXT DEFAULT 'yacht',
  market_city TEXT,
  market_country TEXT DEFAULT 'US',
  marina_location TEXT,
  guest_capacity INTEGER,
  crew_capacity INTEGER,
  bedrooms INTEGER,
  bathrooms INTEGER,
  duration_min_hours NUMERIC DEFAULT 2,
  duration_max_hours NUMERIC DEFAULT 24,
  starting_price NUMERIC,
  pricing_model TEXT DEFAULT 'hourly',
  amenities TEXT[],
  add_ons_supported TEXT[],
  image_urls TEXT[],
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.yacht_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_yacht_inventory" ON public.yacht_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_yacht_inventory" ON public.yacht_inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_yacht_inv_city ON public.yacht_inventory(market_city);
CREATE INDEX idx_yacht_inv_type ON public.yacht_inventory(vessel_type);

CREATE TABLE public.yacht_market_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city TEXT NOT NULL,
  country TEXT DEFAULT 'US',
  base_markup_percentage NUMERIC DEFAULT 25,
  rush_markup_percentage NUMERIC DEFAULT 15,
  weekend_markup_percentage NUMERIC DEFAULT 10,
  peak_season_multiplier NUMERIC DEFAULT 1.0,
  service_fee NUMERIC DEFAULT 0,
  minimum_booking_hours NUMERIC DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.yacht_market_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_yacht_rules" ON public.yacht_market_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_yacht_rules" ON public.yacht_market_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.yacht_booking_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  experience_type TEXT,
  occasion_type TEXT,
  city TEXT,
  country TEXT DEFAULT 'US',
  preferred_date DATE,
  preferred_time TIME,
  flexibility_mode TEXT DEFAULT 'exact',
  duration_hours NUMERIC,
  guest_count INTEGER,
  vessel_preference TEXT,
  budget_range TEXT,
  special_requests TEXT,
  request_status TEXT DEFAULT 'pending',
  assigned_staff_user_id UUID,
  urgency_level TEXT DEFAULT 'normal',
  estimated_value NUMERIC,
  internal_priority INTEGER DEFAULT 0,
  latest_status_at TIMESTAMPTZ DEFAULT now(),
  source_channel TEXT DEFAULT 'website',
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.yacht_booking_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_yacht_requests" ON public.yacht_booking_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_yacht_requests" ON public.yacht_booking_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_yacht_req_status ON public.yacht_booking_requests(request_status);
CREATE INDEX idx_yacht_req_city ON public.yacht_booking_requests(city);

CREATE TABLE public.yacht_request_addons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_request_id UUID REFERENCES public.yacht_booking_requests(id) ON DELETE CASCADE,
  addon_code TEXT,
  addon_name TEXT NOT NULL,
  addon_price NUMERIC DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.yacht_request_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_yacht_addons" ON public.yacht_request_addons FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_yacht_addons" ON public.yacht_request_addons FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.yacht_partner_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_request_id UUID REFERENCES public.yacht_booking_requests(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES public.yacht_partners(id) ON DELETE SET NULL,
  inventory_id UUID REFERENCES public.yacht_inventory(id) ON DELETE SET NULL,
  requested_date DATE,
  requested_time TIME,
  requested_duration NUMERIC,
  status TEXT DEFAULT 'pending',
  partner_response_notes TEXT,
  response_deadline_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  sent_by_user_id UUID,
  outreach_channel TEXT DEFAULT 'email',
  internal_rank INTEGER DEFAULT 0,
  last_followup_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.yacht_partner_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_yacht_preq" ON public.yacht_partner_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_yacht_preq" ON public.yacht_partner_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.yacht_partner_time_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_request_id UUID REFERENCES public.yacht_partner_requests(id) ON DELETE CASCADE,
  offered_date DATE,
  offered_time TIME,
  offered_duration NUMERIC,
  offered_price NUMERIC,
  price_notes TEXT,
  option_status TEXT DEFAULT 'available',
  recommendation_score NUMERIC DEFAULT 0,
  is_best_match BOOLEAN DEFAULT false,
  is_lowest_price BOOLEAN DEFAULT false,
  is_fastest_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.yacht_partner_time_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_yacht_time_opts" ON public.yacht_partner_time_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_yacht_time_opts" ON public.yacht_partner_time_options FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.yacht_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_request_id UUID REFERENCES public.yacht_booking_requests(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES public.yacht_partners(id) ON DELETE SET NULL,
  inventory_id UUID REFERENCES public.yacht_inventory(id) ON DELETE SET NULL,
  quote_status TEXT DEFAULT 'draft',
  base_price NUMERIC DEFAULT 0,
  markup_amount NUMERIC DEFAULT 0,
  add_on_amount NUMERIC DEFAULT 0,
  service_fee NUMERIC DEFAULT 0,
  total_price NUMERIC DEFAULT 0,
  quote_notes TEXT,
  expires_at TIMESTAMPTZ,
  recommended_by_user_id UUID,
  is_recommended BOOLEAN DEFAULT false,
  sent_to_customer_at TIMESTAMPTZ,
  viewed_by_customer_at TIMESTAMPTZ,
  accepted_by_customer_at TIMESTAMPTZ,
  declined_by_customer_at TIMESTAMPTZ,
  internal_margin_amount NUMERIC DEFAULT 0,
  upsell_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.yacht_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_yacht_quotes" ON public.yacht_quotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_yacht_quotes" ON public.yacht_quotes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.yacht_confirmed_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_request_id UUID REFERENCES public.yacht_booking_requests(id) ON DELETE CASCADE,
  selected_quote_id UUID REFERENCES public.yacht_quotes(id) ON DELETE SET NULL,
  partner_id UUID REFERENCES public.yacht_partners(id) ON DELETE SET NULL,
  inventory_id UUID REFERENCES public.yacht_inventory(id) ON DELETE SET NULL,
  confirmed_date DATE,
  confirmed_time TIME,
  confirmed_duration NUMERIC,
  guest_count INTEGER,
  booking_status TEXT DEFAULT 'awaiting_payment',
  payment_status TEXT DEFAULT 'pending',
  confirmation_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.yacht_confirmed_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_yacht_bookings" ON public.yacht_confirmed_bookings FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_yacht_bookings" ON public.yacht_confirmed_bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.yacht_partner_availability_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID REFERENCES public.yacht_partners(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES public.yacht_inventory(id) ON DELETE SET NULL,
  available_date DATE,
  available_time_start TIME,
  available_time_end TIME,
  notes TEXT,
  source_type TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.yacht_partner_availability_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_yacht_avail" ON public.yacht_partner_availability_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_yacht_avail" ON public.yacht_partner_availability_cache FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.yacht_user_engagement (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  inventory_id UUID REFERENCES public.yacht_inventory(id) ON DELETE SET NULL,
  city TEXT,
  interaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.yacht_user_engagement ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_yacht_engage" ON public.yacht_user_engagement FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_yacht_engage" ON public.yacht_user_engagement FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE public.yacht_curated_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  package_type TEXT,
  target_occasion TEXT,
  city TEXT,
  description TEXT,
  base_starting_price NUMERIC,
  included_items TEXT[],
  suggested_addons TEXT[],
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.yacht_curated_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_yacht_packages" ON public.yacht_curated_packages FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_yacht_packages" ON public.yacht_curated_packages FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.yacht_partner_performance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID REFERENCES public.yacht_partners(id) ON DELETE CASCADE,
  avg_response_minutes NUMERIC DEFAULT 0,
  total_requests INTEGER DEFAULT 0,
  confirmed_requests INTEGER DEFAULT 0,
  rejected_requests INTEGER DEFAULT 0,
  alternate_time_rate NUMERIC DEFAULT 0,
  booking_conversion_rate NUMERIC DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.yacht_partner_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_yacht_perf" ON public.yacht_partner_performance FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_yacht_perf" ON public.yacht_partner_performance FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Yacht Ops Extension Tables
CREATE TABLE public.yacht_request_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_request_id UUID REFERENCES public.yacht_booking_requests(id) ON DELETE CASCADE,
  actor_user_id UUID,
  activity_type TEXT NOT NULL,
  activity_label TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.yacht_request_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_yacht_activity" ON public.yacht_request_activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_yacht_activity" ON public.yacht_request_activity_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE public.yacht_request_internal_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_request_id UUID REFERENCES public.yacht_booking_requests(id) ON DELETE CASCADE,
  author_user_id UUID,
  note_text TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.yacht_request_internal_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_yacht_notes" ON public.yacht_request_internal_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_yacht_notes" ON public.yacht_request_internal_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.yacht_request_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_request_id UUID REFERENCES public.yacht_booking_requests(id) ON DELETE CASCADE,
  assigned_user_id UUID,
  task_title TEXT NOT NULL,
  task_description TEXT,
  due_at TIMESTAMPTZ,
  task_status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.yacht_request_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_yacht_tasks" ON public.yacht_request_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_yacht_tasks" ON public.yacht_request_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.yacht_quote_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID REFERENCES public.yacht_quotes(id) ON DELETE CASCADE,
  line_type TEXT DEFAULT 'base',
  label TEXT NOT NULL,
  description TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  total_price NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.yacht_quote_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_yacht_line_items" ON public.yacht_quote_line_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_yacht_line_items" ON public.yacht_quote_line_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.yacht_payment_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_request_id UUID REFERENCES public.yacht_booking_requests(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES public.yacht_quotes(id) ON DELETE SET NULL,
  payment_status TEXT DEFAULT 'pending',
  payment_amount NUMERIC DEFAULT 0,
  payment_due_at TIMESTAMPTZ,
  payment_received_at TIMESTAMPTZ,
  payment_method TEXT,
  payment_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.yacht_payment_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_yacht_payments" ON public.yacht_payment_tracking FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_yacht_payments" ON public.yacht_payment_tracking FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.yacht_ops_metrics_daily (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_date DATE NOT NULL,
  city TEXT,
  total_requests INTEGER DEFAULT 0,
  quotes_sent INTEGER DEFAULT 0,
  confirmed_bookings INTEGER DEFAULT 0,
  cancellations INTEGER DEFAULT 0,
  avg_booking_value NUMERIC DEFAULT 0,
  upsell_revenue NUMERIC DEFAULT 0,
  avg_partner_response_minutes NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.yacht_ops_metrics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_yacht_metrics" ON public.yacht_ops_metrics_daily FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_yacht_metrics" ON public.yacht_ops_metrics_daily FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 4. EXOTIC CAR ENGINE (8 tables)
-- ============================================

CREATE TABLE public.exotic_car_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'US',
  service_areas TEXT[],
  supports_self_drive BOOLEAN DEFAULT true,
  supports_chauffeur BOOLEAN DEFAULT true,
  supports_same_day BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active',
  avg_response_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exotic_car_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_exotic_partners" ON public.exotic_car_partners FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_exotic_partners" ON public.exotic_car_partners FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.exotic_car_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID REFERENCES public.exotic_car_partners(id) ON DELETE CASCADE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  vehicle_type TEXT DEFAULT 'exotic',
  city TEXT,
  state TEXT,
  seats INTEGER DEFAULT 2,
  hourly_price NUMERIC,
  daily_price NUMERIC,
  minimum_hours NUMERIC DEFAULT 4,
  drive_mode TEXT DEFAULT 'either',
  availability_mode TEXT DEFAULT 'request',
  image_urls TEXT[],
  tags TEXT[],
  features TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exotic_car_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_exotic_inv" ON public.exotic_car_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_exotic_inv" ON public.exotic_car_inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_exotic_inv_city ON public.exotic_car_inventory(city);
CREATE INDEX idx_exotic_inv_make ON public.exotic_car_inventory(make);

CREATE TABLE public.exotic_car_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  city TEXT,
  state TEXT,
  requested_make TEXT,
  requested_model TEXT,
  requested_date DATE,
  requested_time TIME,
  duration_hours NUMERIC,
  drive_mode TEXT DEFAULT 'self_drive',
  occasion_type TEXT,
  delivery_location TEXT,
  special_requests TEXT,
  request_status TEXT DEFAULT 'pending',
  assigned_staff_user_id UUID,
  urgency_level TEXT DEFAULT 'normal',
  estimated_value NUMERIC,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exotic_car_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_exotic_req" ON public.exotic_car_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_exotic_req" ON public.exotic_car_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_exotic_req_status ON public.exotic_car_requests(request_status);
CREATE INDEX idx_exotic_req_city ON public.exotic_car_requests(city);

CREATE TABLE public.exotic_car_partner_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exotic_car_request_id UUID REFERENCES public.exotic_car_requests(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES public.exotic_car_partners(id) ON DELETE SET NULL,
  inventory_id UUID REFERENCES public.exotic_car_inventory(id) ON DELETE SET NULL,
  requested_date DATE,
  requested_time TIME,
  status TEXT DEFAULT 'pending',
  response_notes TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exotic_car_partner_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_exotic_preq" ON public.exotic_car_partner_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_exotic_preq" ON public.exotic_car_partner_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.exotic_car_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exotic_car_request_id UUID REFERENCES public.exotic_car_requests(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES public.exotic_car_partners(id) ON DELETE SET NULL,
  inventory_id UUID REFERENCES public.exotic_car_inventory(id) ON DELETE SET NULL,
  quote_status TEXT DEFAULT 'draft',
  hourly_price NUMERIC DEFAULT 0,
  daily_price NUMERIC DEFAULT 0,
  delivery_fee NUMERIC DEFAULT 0,
  chauffeur_fee NUMERIC DEFAULT 0,
  service_fee NUMERIC DEFAULT 0,
  total_price NUMERIC DEFAULT 0,
  quote_notes TEXT,
  expires_at TIMESTAMPTZ,
  is_recommended BOOLEAN DEFAULT false,
  internal_margin NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exotic_car_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_exotic_quotes" ON public.exotic_car_quotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_exotic_quotes" ON public.exotic_car_quotes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.exotic_car_delivery_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID REFERENCES public.exotic_car_quotes(id) ON DELETE CASCADE,
  delivery_type TEXT DEFAULT 'hotel',
  delivery_address TEXT,
  delivery_fee NUMERIC DEFAULT 0,
  pickup_fee NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exotic_car_delivery_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_exotic_delivery" ON public.exotic_car_delivery_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_exotic_delivery" ON public.exotic_car_delivery_options FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.exotic_car_curated_use_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  use_case_type TEXT,
  description TEXT,
  suggested_vehicle_tags TEXT[],
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exotic_car_curated_use_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_exotic_cases" ON public.exotic_car_curated_use_cases FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_exotic_cases" ON public.exotic_car_curated_use_cases FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.exotic_car_market_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city TEXT NOT NULL,
  state TEXT,
  weekend_markup NUMERIC DEFAULT 10,
  same_day_markup NUMERIC DEFAULT 20,
  service_fee NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exotic_car_market_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_exotic_rules" ON public.exotic_car_market_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_manage_exotic_rules" ON public.exotic_car_market_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
