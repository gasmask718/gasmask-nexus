-- ═══════════════════════════════════════════════════════════════════════════════
-- BRAND CRM CONTACT SYSTEM UPGRADE
-- Adds roles, multi-role assignment, and store linking
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Create contact_role enum if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'brand_contact_role') THEN
    CREATE TYPE public.brand_contact_role AS ENUM (
      'owner', 'manager', 'buyer', 'assistant', 
      'accounting', 'marketing', 'decision_maker', 'other'
    );
  END IF;
END $$;

-- 2. Add new columns to brand_crm_contacts for roles
ALTER TABLE public.brand_crm_contacts 
ADD COLUMN IF NOT EXISTS primary_role text DEFAULT 'other',
ADD COLUMN IF NOT EXISTS additional_roles text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS is_primary_contact boolean DEFAULT false;

-- 3. Create brand_contact_store_links table for many-to-many relationship
CREATE TABLE IF NOT EXISTS public.brand_contact_store_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.brand_crm_contacts(id) ON DELETE CASCADE,
  store_master_id uuid NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  brand text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(contact_id, store_master_id)
);

-- 4. Create custom_contact_roles table for user-defined roles
CREATE TABLE IF NOT EXISTS public.custom_contact_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text NOT NULL,
  brand text,
  color text DEFAULT '#6B7280',
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(role_name, brand)
);

-- 5. Enable RLS on new tables
ALTER TABLE public.brand_contact_store_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_contact_roles ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for brand_contact_store_links
CREATE POLICY "Authenticated users can view brand contact store links"
ON public.brand_contact_store_links FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Elevated users can manage brand contact store links"
ON public.brand_contact_store_links FOR ALL
TO authenticated USING (public.is_elevated_user(auth.uid()));

-- 7. RLS Policies for custom_contact_roles
CREATE POLICY "Authenticated users can view custom contact roles"
ON public.custom_contact_roles FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Elevated users can manage custom contact roles"
ON public.custom_contact_roles FOR ALL
TO authenticated USING (public.is_elevated_user(auth.uid()));

-- 8. Seed default roles into custom_contact_roles
INSERT INTO public.custom_contact_roles (role_name, brand, color)
VALUES 
  ('Owner', NULL, '#EF4444'),
  ('Manager', NULL, '#3B82F6'),
  ('Buyer', NULL, '#10B981'),
  ('Assistant', NULL, '#8B5CF6'),
  ('Accounting', NULL, '#F59E0B'),
  ('Marketing', NULL, '#EC4899'),
  ('Decision Maker', NULL, '#6366F1'),
  ('Other', NULL, '#6B7280')
ON CONFLICT (role_name, brand) DO NOTHING;

-- 9. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_brand_contact_store_links_contact 
ON public.brand_contact_store_links(contact_id);

CREATE INDEX IF NOT EXISTS idx_brand_contact_store_links_store 
ON public.brand_contact_store_links(store_master_id);

CREATE INDEX IF NOT EXISTS idx_brand_crm_contacts_role 
ON public.brand_crm_contacts(primary_role);