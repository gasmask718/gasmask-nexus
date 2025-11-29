-- Add store_price column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS store_price numeric;

-- Create customer_profiles table
CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  full_name text,
  phone text,
  preferred_language text DEFAULT 'en',
  city text,
  state text,
  country text DEFAULT 'USA',
  marketing_opt_in boolean DEFAULT false,
  status text DEFAULT 'active',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for customer_profiles
CREATE POLICY "Users can view own customer profile"
  ON public.customer_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own customer profile"
  ON public.customer_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own customer profile"
  ON public.customer_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all customer profiles"
  ON public.customer_profiles FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));