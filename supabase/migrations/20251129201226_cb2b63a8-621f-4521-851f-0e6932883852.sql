-- Phase 32: User Profiles + Role-Specific Profile Tables

-- 1. Unified user_profiles table
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  primary_role TEXT NOT NULL CHECK (primary_role IN (
    'admin', 'va', 'driver', 'biker', 'ambassador', 'wholesaler', 'store_owner', 'production'
  )),
  extra_roles TEXT[] DEFAULT '{}',
  preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'es', 'ar', 'fr')),
  timezone TEXT DEFAULT 'America/New_York',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own profile"
ON public.user_profiles FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users update their own profile"
ON public.user_profiles FOR UPDATE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert their own profile"
ON public.user_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete profiles"
ON public.user_profiles FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Driver Profiles
CREATE TABLE public.driver_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  region TEXT,
  vehicle_type TEXT,
  license_number TEXT,
  insurance_verified BOOLEAN DEFAULT false,
  pay_type TEXT DEFAULT 'per_route' CHECK (pay_type IN ('per_route','per_hour','per_delivery')),
  default_city TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver sees own profile"
ON public.driver_profiles FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "driver updates own profile"
ON public.driver_profiles FOR UPDATE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "driver inserts own profile"
ON public.driver_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 3. Biker Profiles
CREATE TABLE public.biker_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  region TEXT,
  zone TEXT,
  primary_transport TEXT,
  default_city TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.biker_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "biker sees own profile"
ON public.biker_profiles FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "biker updates own profile"
ON public.biker_profiles FOR UPDATE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "biker inserts own profile"
ON public.biker_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 4. Ambassador Profiles
CREATE TABLE public.ambassador_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
  brand TEXT NOT NULL DEFAULT 'GasMask',
  referral_code TEXT UNIQUE,
  commission_rate NUMERIC DEFAULT 0.10,
  tiktok_handle TEXT,
  instagram_handle TEXT,
  country TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ambassador_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ambassador sees own profile"
ON public.ambassador_profiles FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ambassador updates own profile"
ON public.ambassador_profiles FOR UPDATE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ambassador inserts own profile"
ON public.ambassador_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 5. Wholesaler Profiles
CREATE TABLE public.wholesaler_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  tax_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','suspended')),
  wholesaler_type TEXT DEFAULT 'distributor',
  website_url TEXT,
  shipping_preferences JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.wholesaler_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wholesaler sees own profile"
ON public.wholesaler_profiles FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "wholesaler updates own profile"
ON public.wholesaler_profiles FOR UPDATE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "wholesaler inserts own profile"
ON public.wholesaler_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 6. Store Profiles
CREATE TABLE public.store_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'USA',
  preferred_delivery_day TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.store_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store sees own profile"
ON public.store_profiles FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "store updates own profile"
ON public.store_profiles FOR UPDATE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "store inserts own profile"
ON public.store_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 7. Production Profiles
CREATE TABLE public.production_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('roller','packager','qc','supervisor')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  shift TEXT,
  station TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.production_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production sees own profile"
ON public.production_profiles FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "production updates own profile"
ON public.production_profiles FOR UPDATE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "production inserts own profile"
ON public.production_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 8. VA Profiles
CREATE TABLE public.va_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT DEFAULT 'VA',
  permissions_bundle TEXT DEFAULT 'standard',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.va_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "va sees own profile"
ON public.va_profiles FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "va updates own profile"
ON public.va_profiles FOR UPDATE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "va inserts own profile"
ON public.va_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Indexes for performance
CREATE INDEX idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX idx_user_profiles_role ON public.user_profiles(primary_role);
CREATE INDEX idx_driver_profiles_user_id ON public.driver_profiles(user_id);
CREATE INDEX idx_biker_profiles_user_id ON public.biker_profiles(user_id);
CREATE INDEX idx_ambassador_profiles_user_id ON public.ambassador_profiles(user_id);
CREATE INDEX idx_wholesaler_profiles_user_id ON public.wholesaler_profiles(user_id);
CREATE INDEX idx_store_profiles_user_id ON public.store_profiles(user_id);
CREATE INDEX idx_production_profiles_user_id ON public.production_profiles(user_id);
CREATE INDEX idx_va_profiles_user_id ON public.va_profiles(user_id);