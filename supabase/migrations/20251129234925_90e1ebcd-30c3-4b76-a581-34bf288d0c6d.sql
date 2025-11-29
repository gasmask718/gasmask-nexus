-- Phase 41: Multi-User Organization System

-- Organizations table (one per store or wholesaler)
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_type TEXT NOT NULL CHECK (org_type IN ('store', 'wholesaler')),
  name TEXT NOT NULL,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  billing_email TEXT,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Organization user roles enum
CREATE TYPE public.org_role AS ENUM (
  'owner',
  'manager',
  'inventory_staff',
  'cashier',
  'shipping_staff',
  'support_staff',
  'back_office'
);

-- Organization users (staff members)
CREATE TABLE IF NOT EXISTS public.organization_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role org_role NOT NULL DEFAULT 'support_staff',
  permissions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- Organization invites
CREATE TABLE IF NOT EXISTS public.organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_role org_role NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours'),
  accepted BOOLEAN DEFAULT false,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Activity logs for staff actions
CREATE TABLE IF NOT EXISTS public.org_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  activity_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Permissions matrix (reference table)
CREATE TABLE IF NOT EXISTS public.permissions_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key TEXT NOT NULL UNIQUE,
  permission_name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  org_types TEXT[] DEFAULT ARRAY['store', 'wholesaler']
);

-- Insert default permissions
INSERT INTO public.permissions_matrix (permission_key, permission_name, description, category, org_types) VALUES
  ('manage_products', 'Manage Products', 'Add, edit, delete products', 'inventory', ARRAY['wholesaler']),
  ('view_products', 'View Products', 'View product catalog', 'inventory', ARRAY['store', 'wholesaler']),
  ('manage_inventory', 'Manage Inventory', 'Update stock levels', 'inventory', ARRAY['store', 'wholesaler']),
  ('view_orders', 'View Orders', 'View order list', 'orders', ARRAY['store', 'wholesaler']),
  ('manage_orders', 'Manage Orders', 'Process and update orders', 'orders', ARRAY['store', 'wholesaler']),
  ('ship_orders', 'Ship Orders', 'Print labels and mark shipped', 'orders', ARRAY['wholesaler']),
  ('refund_orders', 'Refund Orders', 'Process refunds and replacements', 'orders', ARRAY['store', 'wholesaler']),
  ('view_financials', 'View Financials', 'View revenue and reports', 'finance', ARRAY['store', 'wholesaler']),
  ('manage_payments', 'Manage Payments', 'Mark invoices paid', 'finance', ARRAY['store', 'wholesaler']),
  ('edit_prices', 'Edit Prices', 'Change product pricing', 'finance', ARRAY['wholesaler']),
  ('manage_staff', 'Manage Staff', 'Add, remove, edit staff', 'admin', ARRAY['store', 'wholesaler']),
  ('view_staff', 'View Staff', 'View team members', 'admin', ARRAY['store', 'wholesaler']),
  ('manage_profile', 'Manage Profile', 'Edit organization profile', 'admin', ARRAY['store', 'wholesaler']),
  ('view_reports', 'View Reports', 'Access analytics and reports', 'analytics', ARRAY['store', 'wholesaler']),
  ('send_messages', 'Send Messages', 'Send and receive messages', 'communication', ARRAY['store', 'wholesaler']),
  ('view_activity', 'View Activity', 'View activity logs', 'admin', ARRAY['store', 'wholesaler'])
ON CONFLICT (permission_key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions_matrix ENABLE ROW LEVEL SECURITY;

-- Function to check org membership
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_users
    WHERE user_id = _user_id AND org_id = _org_id AND is_active = true
  )
$$;

-- Function to check org role
CREATE OR REPLACE FUNCTION public.has_org_role(_user_id UUID, _org_id UUID, _role org_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_users
    WHERE user_id = _user_id AND org_id = _org_id AND role = _role AND is_active = true
  )
$$;

-- Function to check if user is org owner or manager
CREATE OR REPLACE FUNCTION public.can_manage_org(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_users
    WHERE user_id = _user_id 
    AND org_id = _org_id 
    AND role IN ('owner', 'manager')
    AND is_active = true
  )
$$;

-- RLS Policies for organizations
CREATE POLICY "Users can view their organizations"
ON public.organizations FOR SELECT
TO authenticated
USING (public.is_org_member(auth.uid(), id) OR owner_user_id = auth.uid());

CREATE POLICY "Owners can update their organizations"
ON public.organizations FOR UPDATE
TO authenticated
USING (owner_user_id = auth.uid());

CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (owner_user_id = auth.uid());

-- RLS Policies for organization_users
CREATE POLICY "Users can view org members"
ON public.organization_users FOR SELECT
TO authenticated
USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Managers can add org members"
ON public.organization_users FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_org(auth.uid(), org_id));

CREATE POLICY "Managers can update org members"
ON public.organization_users FOR UPDATE
TO authenticated
USING (public.can_manage_org(auth.uid(), org_id));

CREATE POLICY "Managers can remove org members"
ON public.organization_users FOR DELETE
TO authenticated
USING (public.can_manage_org(auth.uid(), org_id));

-- RLS Policies for organization_invites
CREATE POLICY "Org members can view invites"
ON public.organization_invites FOR SELECT
TO authenticated
USING (public.is_org_member(auth.uid(), org_id) OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Managers can create invites"
ON public.organization_invites FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_org(auth.uid(), org_id));

CREATE POLICY "Managers can update invites"
ON public.organization_invites FOR UPDATE
TO authenticated
USING (public.can_manage_org(auth.uid(), org_id) OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- RLS Policies for activity logs
CREATE POLICY "Org members can view activity logs"
ON public.org_activity_logs FOR SELECT
TO authenticated
USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can insert activity logs"
ON public.org_activity_logs FOR INSERT
TO authenticated
WITH CHECK (public.is_org_member(auth.uid(), org_id));

-- Permissions matrix is readable by all authenticated users
CREATE POLICY "Anyone can view permissions matrix"
ON public.permissions_matrix FOR SELECT
TO authenticated
USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_users_org_id ON public.organization_users(org_id);
CREATE INDEX IF NOT EXISTS idx_org_users_user_id ON public.organization_users(user_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_code ON public.organization_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_org_invites_email ON public.organization_invites(invited_email);
CREATE INDEX IF NOT EXISTS idx_org_activity_org_id ON public.org_activity_logs(org_id);

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.organization_users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.organization_invites;