-- Multi-Tenant CRM Foundation
-- Create businesses/tenants table as the core isolation layer

CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  industry TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  
  -- Subscription & SaaS
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'professional', 'enterprise')),
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'suspended', 'cancelled', 'trial')),
  trial_ends_at TIMESTAMPTZ,
  billing_email TEXT,
  
  -- Customization
  theme_config JSONB DEFAULT '{
    "primaryColor": "#6366f1",
    "mode": "light",
    "density": "comfortable"
  }'::jsonb,
  
  -- Settings
  settings JSONB DEFAULT '{
    "features": {
      "callCenter": true,
      "emailCenter": true,
      "smsCenter": true,
      "invoicing": true,
      "calendar": true,
      "aiFeatures": true
    },
    "integrations": {},
    "widgets": []
  }'::jsonb,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create business_members junction table for multi-user access
CREATE TABLE IF NOT EXISTS public.business_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
  permissions JSONB DEFAULT '{
    "crm": {"read": true, "write": true, "delete": false},
    "settings": {"read": true, "write": false},
    "billing": {"read": false, "write": false}
  }'::jsonb,
  joined_at TIMESTAMPTZ DEFAULT now(),
  invited_by UUID REFERENCES public.profiles(id),
  UNIQUE(business_id, user_id)
);

-- Update crm_contacts to be business-aware
ALTER TABLE public.crm_contacts 
ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;

-- Update communication_logs to be business-aware
ALTER TABLE public.communication_logs 
ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_businesses_slug ON public.businesses(slug);
CREATE INDEX IF NOT EXISTS idx_businesses_active ON public.businesses(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_business_members_user ON public.business_members(user_id);
CREATE INDEX IF NOT EXISTS idx_business_members_business ON public.business_members(business_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_business ON public.crm_contacts(business_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_business ON public.communication_logs(business_id);

-- Enable RLS
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for businesses
CREATE POLICY "Users can view businesses they are members of"
  ON public.businesses FOR SELECT
  USING (
    id IN (
      SELECT business_id FROM public.business_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can update their business"
  ON public.businesses FOR UPDATE
  USING (
    id IN (
      SELECT business_id FROM public.business_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for business_members
CREATE POLICY "Users can view members of their businesses"
  ON public.business_members FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.business_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Business admins can manage members"
  ON public.business_members FOR ALL
  USING (
    business_id IN (
      SELECT business_id FROM public.business_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Update RLS for crm_contacts to respect business isolation
DROP POLICY IF EXISTS "Users can view all contacts" ON public.crm_contacts;
CREATE POLICY "Users can view contacts in their businesses"
  ON public.crm_contacts FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.business_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert contacts in their businesses"
  ON public.crm_contacts FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM public.business_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update contacts in their businesses"
  ON public.crm_contacts FOR UPDATE
  USING (
    business_id IN (
      SELECT business_id FROM public.business_members
      WHERE user_id = auth.uid()
    )
  );

-- Update RLS for communication_logs
DROP POLICY IF EXISTS "Users can view all communication logs" ON public.communication_logs;
CREATE POLICY "Users can view logs in their businesses"
  ON public.communication_logs FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.business_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert logs in their businesses"
  ON public.communication_logs FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM public.business_members
      WHERE user_id = auth.uid()
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_business_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_businesses_timestamp
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION update_business_timestamp();

-- Function to get user's businesses
CREATE OR REPLACE FUNCTION get_user_businesses(user_id UUID)
RETURNS TABLE (
  business_id UUID,
  business_name TEXT,
  business_slug TEXT,
  member_role TEXT,
  logo_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.slug,
    bm.role,
    b.logo_url
  FROM public.businesses b
  INNER JOIN public.business_members bm ON b.id = bm.business_id
  WHERE bm.user_id = user_id
  AND b.is_active = true
  ORDER BY bm.joined_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;