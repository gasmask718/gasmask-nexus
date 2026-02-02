-- =============================================
-- P0 DATA LAYER RESTORATION - Floors 1, 3, 6
-- =============================================

-- 1️⃣ public.contacts - Global CRM contacts
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  role TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2️⃣ public.crm_businesses - Businesses tied to CRM
CREATE TABLE IF NOT EXISTS public.crm_businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  business_type TEXT, -- store, wholesaler, brand, etc
  status TEXT DEFAULT 'active',
  assigned_ambassador UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3️⃣ public.follow_ups - CRM follow-ups & reminders
CREATE TABLE IF NOT EXISTS public.follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  related_entity_type TEXT, -- contact | business | store
  related_entity_id UUID,
  note TEXT,
  due_date DATE,
  completed BOOLEAN DEFAULT false,
  assigned_to UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4️⃣ public.inventory - Inventory Engine (Floor 3)
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID,
  product_id UUID,
  location_id UUID,
  quantity INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now()
);

-- 5️⃣ public.production_work_orders - Manufacturing OS (Floor 6)
CREATE TABLE IF NOT EXISTS public.production_work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID,
  product_id UUID,
  status TEXT DEFAULT 'pending', -- pending | in_progress | completed
  quantity INTEGER,
  assigned_to UUID REFERENCES public.profiles(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_work_orders ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES - contacts
-- =============================================

CREATE POLICY "Authenticated users can read contacts"
ON public.contacts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create contacts"
ON public.contacts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their contacts"
ON public.contacts FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Admins can manage all contacts"
ON public.contacts FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- RLS POLICIES - crm_businesses
-- =============================================

CREATE POLICY "Authenticated users can read crm_businesses"
ON public.crm_businesses FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Ambassadors can manage assigned businesses"
ON public.crm_businesses FOR ALL
TO authenticated
USING (auth.uid() = assigned_ambassador);

CREATE POLICY "Admins can manage all crm_businesses"
ON public.crm_businesses FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- RLS POLICIES - follow_ups
-- =============================================

CREATE POLICY "Authenticated users can read follow_ups"
ON public.follow_ups FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can manage their assigned follow_ups"
ON public.follow_ups FOR ALL
TO authenticated
USING (auth.uid() = assigned_to);

CREATE POLICY "Admins can manage all follow_ups"
ON public.follow_ups FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- RLS POLICIES - inventory
-- =============================================

CREATE POLICY "Authenticated users can read inventory"
ON public.inventory FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage inventory"
ON public.inventory FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- RLS POLICIES - production_work_orders
-- =============================================

CREATE POLICY "Authenticated users can read work orders"
ON public.production_work_orders FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Workers can update assigned work orders"
ON public.production_work_orders FOR UPDATE
TO authenticated
USING (auth.uid() = assigned_to);

CREATE POLICY "Admins can manage all work orders"
ON public.production_work_orders FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON public.contacts(created_at);
CREATE INDEX IF NOT EXISTS idx_contacts_created_by ON public.contacts(created_by);

CREATE INDEX IF NOT EXISTS idx_crm_businesses_created_at ON public.crm_businesses(created_at);
CREATE INDEX IF NOT EXISTS idx_crm_businesses_assigned ON public.crm_businesses(assigned_ambassador);

CREATE INDEX IF NOT EXISTS idx_follow_ups_due_date ON public.follow_ups(due_date);
CREATE INDEX IF NOT EXISTS idx_follow_ups_assigned ON public.follow_ups(assigned_to);
CREATE INDEX IF NOT EXISTS idx_follow_ups_entity ON public.follow_ups(related_entity_type, related_entity_id);

CREATE INDEX IF NOT EXISTS idx_inventory_product ON public.inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_location ON public.inventory(location_id);

CREATE INDEX IF NOT EXISTS idx_work_orders_status ON public.production_work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned ON public.production_work_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_orders_created ON public.production_work_orders(created_at);