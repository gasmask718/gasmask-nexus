-- Create VA role types enum
CREATE TYPE public.va_role AS ENUM (
  'grabba_cluster_va',
  'gasmask_va',
  'hotmama_va',
  'grabba_r_us_va',
  'hot_scalati_va',
  'toptier_va',
  'unforgettable_va',
  'iclean_va',
  'playboxxx_va',
  'funding_va',
  'grants_va',
  'credit_repair_va',
  'special_needs_va',
  'sports_betting_va',
  'admin',
  'owner'
);

-- Create VA permissions table
CREATE TABLE public.va_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  va_role public.va_role NOT NULL,
  allowed_brands TEXT[] NOT NULL DEFAULT '{}',
  can_access_upload_engine BOOLEAN DEFAULT false,
  can_access_delivery_routing BOOLEAN DEFAULT false,
  can_access_ai_engine BOOLEAN DEFAULT false,
  can_access_dashboard BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.va_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for VA permissions
CREATE POLICY "Users can view their own permissions"
  ON public.va_permissions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all permissions"
  ON public.va_permissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.va_permissions
      WHERE user_id = auth.uid() AND va_role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can manage permissions"
  ON public.va_permissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.va_permissions
      WHERE user_id = auth.uid() AND va_role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.va_permissions
      WHERE user_id = auth.uid() AND va_role IN ('admin', 'owner')
    )
  );

-- Security definer function to check VA brand access
CREATE OR REPLACE FUNCTION public.can_access_brand(_user_id UUID, _brand TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_brands TEXT[];
  user_va_role va_role;
BEGIN
  SELECT allowed_brands, va_role INTO user_brands, user_va_role
  FROM public.va_permissions
  WHERE user_id = _user_id;
  
  IF user_brands IS NULL THEN
    RETURN false;
  END IF;
  
  IF user_va_role IN ('owner', 'admin') THEN
    RETURN true;
  END IF;
  
  RETURN _brand = ANY(user_brands);
END;
$$;

-- Update brand_crm_contacts to respect VA permissions (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'brand_crm_contacts') THEN
    ALTER TABLE public.brand_crm_contacts ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "VAs can only access their brand contacts" ON public.brand_crm_contacts;
    
    CREATE POLICY "VAs can only access their brand contacts"
      ON public.brand_crm_contacts
      FOR ALL
      TO authenticated
      USING (public.can_access_brand(auth.uid(), brand::text))
      WITH CHECK (public.can_access_brand(auth.uid(), brand::text));
  END IF;
END $$;

-- Update store_brand_accounts to respect VA permissions (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'store_brand_accounts') THEN
    ALTER TABLE public.store_brand_accounts ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "VAs can only access their brand accounts" ON public.store_brand_accounts;
    
    CREATE POLICY "VAs can only access their brand accounts"
      ON public.store_brand_accounts
      FOR ALL
      TO authenticated
      USING (public.can_access_brand(auth.uid(), brand::text))
      WITH CHECK (public.can_access_brand(auth.uid(), brand::text));
  END IF;
END $$;