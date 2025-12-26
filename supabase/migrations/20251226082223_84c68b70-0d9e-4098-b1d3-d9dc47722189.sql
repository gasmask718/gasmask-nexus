-- Create enum for Unforgettable Times staff roles
CREATE TYPE public.ut_staff_role AS ENUM (
  -- Core Leadership
  'owner_managing_director',
  'operations_director',
  'event_production_manager',
  
  -- Event Planning & Client Experience
  'event_coordinator_lead',
  'event_coordinator_assistant',
  'client_success_manager',
  
  -- Venue & Partner Management
  'venue_relations_manager',
  'vendor_relations_manager',
  'partner_onboarding_specialist',
  
  -- Rentals & Party Inventory
  'rental_operations_manager',
  'inventory_coordinator',
  'setup_crew_lead',
  'setup_crew_member',
  
  -- Entertainment & Experience
  'dj_coordinator',
  'dj',
  'mc_host',
  'live_performer',
  
  -- Food & Bar Services
  'catering_coordinator',
  'bartending_manager',
  'bartender',
  'server',
  
  -- Security & Safety
  'security_coordinator',
  'security_guard',
  'event_safety_supervisor',
  
  -- Logistics & Transport
  'logistics_manager',
  'driver',
  'loader_runner',
  
  -- Media & Content
  'photography_coordinator',
  'photographer',
  'videographer',
  'content_editor',
  
  -- Admin, Finance & Support
  'finance_manager',
  'accounts_payable_receivable',
  'contracts_compliance_admin',
  'crm_data_manager',
  
  -- Marketing & Growth
  'marketing_manager',
  'social_media_manager',
  'influencer_ambassador_coordinator',
  
  -- Virtual & Remote Support
  'virtual_assistant',
  'customer_support_rep'
);

-- Create enum for staff category grouping
CREATE TYPE public.ut_staff_category AS ENUM (
  'internal_staff',
  'event_staff',
  'vendor',
  'partner'
);

-- Create enum for staff employment type
CREATE TYPE public.ut_employment_type AS ENUM (
  'full_time',
  'part_time',
  'contractor',
  '1099_hourly',
  'per_event'
);

-- Create enum for staff status
CREATE TYPE public.ut_staff_status AS ENUM (
  'active',
  'inactive',
  'pending',
  'on_leave',
  'terminated'
);

-- Create the Unforgettable Times staff table
CREATE TABLE public.ut_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Basic Info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  
  -- Role & Category
  role public.ut_staff_role NOT NULL,
  category public.ut_staff_category NOT NULL DEFAULT 'event_staff',
  employment_type public.ut_employment_type NOT NULL DEFAULT 'contractor',
  status public.ut_staff_status NOT NULL DEFAULT 'active',
  
  -- Work Details
  department TEXT,
  hire_date DATE,
  hourly_rate DECIMAL(10,2),
  event_rate DECIMAL(10,2),
  
  -- Availability
  availability JSONB DEFAULT '{}',
  preferred_hours JSONB DEFAULT '{}',
  certifications TEXT[],
  specialties TEXT[],
  
  -- Payment Info
  payment_method TEXT,
  payment_details JSONB DEFAULT '{}',
  total_earnings DECIMAL(12,2) DEFAULT 0,
  
  -- Performance
  events_completed INTEGER DEFAULT 0,
  rating DECIMAL(3,2),
  notes TEXT,
  
  -- Emergency Contact
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

-- Create staff event assignments table
CREATE TABLE public.ut_staff_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.ut_staff(id) ON DELETE CASCADE,
  event_id UUID,
  
  -- Assignment Details
  role_for_event public.ut_staff_role,
  assignment_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled',
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  
  -- Payment
  hours_worked DECIMAL(5,2),
  rate_applied DECIMAL(10,2),
  payment_status TEXT DEFAULT 'pending',
  amount_due DECIMAL(10,2),
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ut_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_staff_assignments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for ut_staff
CREATE POLICY "Business members can view staff"
ON public.ut_staff
FOR SELECT
USING (
  public.is_business_member(business_id, auth.uid()) OR
  public.is_admin(auth.uid()) OR
  public.is_owner(auth.uid())
);

CREATE POLICY "Admins and owners can manage staff"
ON public.ut_staff
FOR ALL
USING (
  public.is_admin(auth.uid()) OR
  public.is_owner(auth.uid()) OR
  public.is_business_admin(business_id, auth.uid())
);

-- Create RLS policies for ut_staff_assignments
CREATE POLICY "Business members can view assignments"
ON public.ut_staff_assignments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.ut_staff s
    WHERE s.id = ut_staff_assignments.staff_id
    AND (
      public.is_business_member(s.business_id, auth.uid()) OR
      public.is_admin(auth.uid()) OR
      public.is_owner(auth.uid())
    )
  )
);

CREATE POLICY "Admins and owners can manage assignments"
ON public.ut_staff_assignments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.ut_staff s
    WHERE s.id = ut_staff_assignments.staff_id
    AND (
      public.is_admin(auth.uid()) OR
      public.is_owner(auth.uid()) OR
      public.is_business_admin(s.business_id, auth.uid())
    )
  )
);

-- Create indexes for performance
CREATE INDEX idx_ut_staff_business ON public.ut_staff(business_id);
CREATE INDEX idx_ut_staff_role ON public.ut_staff(role);
CREATE INDEX idx_ut_staff_category ON public.ut_staff(category);
CREATE INDEX idx_ut_staff_status ON public.ut_staff(status);
CREATE INDEX idx_ut_staff_deleted ON public.ut_staff(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_ut_staff_assignments_staff ON public.ut_staff_assignments(staff_id);
CREATE INDEX idx_ut_staff_assignments_date ON public.ut_staff_assignments(assignment_date);

-- Create updated_at trigger
CREATE TRIGGER update_ut_staff_updated_at
BEFORE UPDATE ON public.ut_staff
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ut_staff_assignments_updated_at
BEFORE UPDATE ON public.ut_staff_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();