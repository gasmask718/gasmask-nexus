-- =====================================================
-- TOPTIER EXPERIENCE CRM - KPI-DRIVEN ARCHITECTURE
-- =====================================================

-- 1. DRIVERS TABLE
CREATE TABLE public.tt_drivers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  
  -- Basic Info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  phone TEXT,
  email TEXT,
  photo_url TEXT,
  
  -- Status & Assignment
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave', 'terminated')),
  duty_status TEXT NOT NULL DEFAULT 'off_duty' CHECK (duty_status IN ('on_duty', 'off_duty', 'break')),
  assignment_status TEXT NOT NULL DEFAULT 'unassigned' CHECK (assignment_status IN ('assigned', 'unassigned', 'pending')),
  
  -- Vehicle Info
  has_vehicle BOOLEAN DEFAULT false,
  vehicle_id UUID,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  vehicle_color TEXT,
  license_plate TEXT,
  
  -- Notes (word-for-word, no edits)
  intake_notes TEXT,
  admin_notes TEXT,
  
  -- Metadata
  hired_date DATE,
  rating NUMERIC(2,1) DEFAULT 5.0,
  total_trips INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  is_simulation BOOLEAN DEFAULT false
);

-- 2. THINGS TO DO (EXPERIENCES) TABLE
CREATE TABLE public.tt_experiences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  
  -- Experience Info
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general' CHECK (category IN ('dining', 'entertainment', 'wellness', 'adventure', 'cultural', 'nightlife', 'shopping', 'general')),
  
  -- Status & Availability
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'booked', 'pending', 'completed', 'cancelled')),
  availability TEXT DEFAULT 'open' CHECK (availability IN ('open', 'limited', 'sold_out', 'by_request')),
  
  -- Partner Info
  is_partner_provided BOOLEAN DEFAULT false,
  partner_id UUID,
  partner_name TEXT,
  
  -- Pricing
  is_complimentary BOOLEAN DEFAULT false,
  price NUMERIC(10,2),
  revenue_generated NUMERIC(10,2) DEFAULT 0,
  
  -- Scheduling
  scheduled_date DATE,
  scheduled_time TIME,
  duration_hours NUMERIC(4,2),
  location TEXT,
  
  -- Notes (word-for-word)
  notes TEXT,
  special_requirements TEXT,
  
  -- Metadata
  max_guests INTEGER,
  current_guests INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  is_simulation BOOLEAN DEFAULT false
);

-- 3. PRIVATE JET TABLE
CREATE TABLE public.tt_private_jets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  
  -- Jet Info
  name TEXT NOT NULL,
  tail_number TEXT,
  jet_type TEXT CHECK (jet_type IN ('light', 'midsize', 'super_midsize', 'heavy', 'ultra_long_range')),
  manufacturer TEXT,
  model TEXT,
  year INTEGER,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'booked', 'maintenance', 'in_transit', 'grounded')),
  approval_status TEXT DEFAULT 'approved' CHECK (approval_status IN ('approved', 'pending', 'rejected')),
  
  -- Partner Info
  is_partner_jet BOOLEAN DEFAULT false,
  partner_id UUID,
  partner_name TEXT,
  
  -- Capacity & Range
  passenger_capacity INTEGER,
  range_nautical_miles INTEGER,
  base_location TEXT,
  current_location TEXT,
  
  -- Charter Info
  hourly_rate NUMERIC(10,2),
  daily_rate NUMERIC(10,2),
  total_charters INTEGER DEFAULT 0,
  
  -- Notes (word-for-word)
  notes TEXT,
  maintenance_notes TEXT,
  
  -- Metadata
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  is_simulation BOOLEAN DEFAULT false
);

-- 4. CHARTER REQUESTS TABLE
CREATE TABLE public.tt_charter_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  jet_id UUID REFERENCES public.tt_private_jets(id),
  
  -- Request Info
  customer_name TEXT NOT NULL,
  customer_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'confirmed', 'completed', 'cancelled')),
  
  -- Trip Details
  departure_location TEXT,
  arrival_location TEXT,
  departure_date DATE,
  departure_time TIME,
  return_date DATE,
  passenger_count INTEGER,
  
  -- Pricing
  quoted_price NUMERIC(10,2),
  final_price NUMERIC(10,2),
  
  -- Notes
  notes TEXT,
  special_requests TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  is_simulation BOOLEAN DEFAULT false
);

-- 5. CUSTOM KPI DEFINITIONS (Admin-created)
CREATE TABLE public.tt_kpi_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  
  -- KPI Info
  section TEXT NOT NULL CHECK (section IN ('drivers', 'experiences', 'jets', 'charters')),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'BarChart3',
  color TEXT DEFAULT 'cyan',
  
  -- Query Configuration
  table_name TEXT NOT NULL,
  count_type TEXT DEFAULT 'total' CHECK (count_type IN ('total', 'filtered', 'sum', 'average')),
  filter_field TEXT,
  filter_value TEXT,
  sum_field TEXT,
  
  -- Display
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  show_on_dashboard BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on all tables
ALTER TABLE public.tt_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tt_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tt_private_jets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tt_charter_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tt_kpi_definitions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tt_drivers
CREATE POLICY "Users can view drivers" ON public.tt_drivers
  FOR SELECT USING (
    public.is_admin(auth.uid()) OR public.is_owner(auth.uid()) OR public.is_elevated_user(auth.uid())
  );

CREATE POLICY "Elevated users can create drivers" ON public.tt_drivers
  FOR INSERT WITH CHECK (
    public.is_admin(auth.uid()) OR public.is_owner(auth.uid()) OR public.is_elevated_user(auth.uid())
  );

CREATE POLICY "Elevated users can update drivers" ON public.tt_drivers
  FOR UPDATE USING (
    public.is_admin(auth.uid()) OR public.is_owner(auth.uid()) OR public.is_elevated_user(auth.uid())
  );

CREATE POLICY "Admins can delete drivers" ON public.tt_drivers
  FOR DELETE USING (
    public.is_admin(auth.uid()) OR public.is_owner(auth.uid())
  );

-- RLS Policies for tt_experiences
CREATE POLICY "Users can view experiences" ON public.tt_experiences
  FOR SELECT USING (
    public.is_admin(auth.uid()) OR public.is_owner(auth.uid()) OR public.is_elevated_user(auth.uid())
  );

CREATE POLICY "Elevated users can create experiences" ON public.tt_experiences
  FOR INSERT WITH CHECK (
    public.is_admin(auth.uid()) OR public.is_owner(auth.uid()) OR public.is_elevated_user(auth.uid())
  );

CREATE POLICY "Elevated users can update experiences" ON public.tt_experiences
  FOR UPDATE USING (
    public.is_admin(auth.uid()) OR public.is_owner(auth.uid()) OR public.is_elevated_user(auth.uid())
  );

CREATE POLICY "Admins can delete experiences" ON public.tt_experiences
  FOR DELETE USING (
    public.is_admin(auth.uid()) OR public.is_owner(auth.uid())
  );

-- RLS Policies for tt_private_jets
CREATE POLICY "Users can view jets" ON public.tt_private_jets
  FOR SELECT USING (
    public.is_admin(auth.uid()) OR public.is_owner(auth.uid()) OR public.is_elevated_user(auth.uid())
  );

CREATE POLICY "Elevated users can create jets" ON public.tt_private_jets
  FOR INSERT WITH CHECK (
    public.is_admin(auth.uid()) OR public.is_owner(auth.uid()) OR public.is_elevated_user(auth.uid())
  );

CREATE POLICY "Elevated users can update jets" ON public.tt_private_jets
  FOR UPDATE USING (
    public.is_admin(auth.uid()) OR public.is_owner(auth.uid()) OR public.is_elevated_user(auth.uid())
  );

CREATE POLICY "Admins can delete jets" ON public.tt_private_jets
  FOR DELETE USING (
    public.is_admin(auth.uid()) OR public.is_owner(auth.uid())
  );

-- RLS Policies for tt_charter_requests
CREATE POLICY "Users can view charter requests" ON public.tt_charter_requests
  FOR SELECT USING (
    public.is_admin(auth.uid()) OR public.is_owner(auth.uid()) OR public.is_elevated_user(auth.uid())
  );

CREATE POLICY "Elevated users can create charter requests" ON public.tt_charter_requests
  FOR INSERT WITH CHECK (
    public.is_admin(auth.uid()) OR public.is_owner(auth.uid()) OR public.is_elevated_user(auth.uid())
  );

CREATE POLICY "Elevated users can update charter requests" ON public.tt_charter_requests
  FOR UPDATE USING (
    public.is_admin(auth.uid()) OR public.is_owner(auth.uid()) OR public.is_elevated_user(auth.uid())
  );

CREATE POLICY "Admins can delete charter requests" ON public.tt_charter_requests
  FOR DELETE USING (
    public.is_admin(auth.uid()) OR public.is_owner(auth.uid())
  );

-- RLS Policies for tt_kpi_definitions
CREATE POLICY "Users can view KPI definitions" ON public.tt_kpi_definitions
  FOR SELECT USING (
    public.is_admin(auth.uid()) OR public.is_owner(auth.uid()) OR public.is_elevated_user(auth.uid())
  );

CREATE POLICY "Admins can manage KPI definitions" ON public.tt_kpi_definitions
  FOR ALL USING (
    public.is_admin(auth.uid()) OR public.is_owner(auth.uid())
  );

-- Indexes for performance
CREATE INDEX idx_tt_drivers_status ON public.tt_drivers(status);
CREATE INDEX idx_tt_drivers_duty ON public.tt_drivers(duty_status);
CREATE INDEX idx_tt_drivers_vehicle ON public.tt_drivers(has_vehicle);
CREATE INDEX idx_tt_drivers_simulation ON public.tt_drivers(is_simulation);

CREATE INDEX idx_tt_experiences_status ON public.tt_experiences(status);
CREATE INDEX idx_tt_experiences_category ON public.tt_experiences(category);
CREATE INDEX idx_tt_experiences_partner ON public.tt_experiences(is_partner_provided);
CREATE INDEX idx_tt_experiences_simulation ON public.tt_experiences(is_simulation);

CREATE INDEX idx_tt_jets_status ON public.tt_private_jets(status);
CREATE INDEX idx_tt_jets_approval ON public.tt_private_jets(approval_status);
CREATE INDEX idx_tt_jets_simulation ON public.tt_private_jets(is_simulation);

CREATE INDEX idx_tt_charters_status ON public.tt_charter_requests(status);
CREATE INDEX idx_tt_charters_jet ON public.tt_charter_requests(jet_id);
CREATE INDEX idx_tt_charters_simulation ON public.tt_charter_requests(is_simulation);

CREATE INDEX idx_tt_kpis_section ON public.tt_kpi_definitions(section);
CREATE INDEX idx_tt_kpis_active ON public.tt_kpi_definitions(is_active);

-- Update triggers
CREATE TRIGGER update_tt_drivers_timestamp
  BEFORE UPDATE ON public.tt_drivers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tt_experiences_timestamp
  BEFORE UPDATE ON public.tt_experiences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tt_jets_timestamp
  BEFORE UPDATE ON public.tt_private_jets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tt_charters_timestamp
  BEFORE UPDATE ON public.tt_charter_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();