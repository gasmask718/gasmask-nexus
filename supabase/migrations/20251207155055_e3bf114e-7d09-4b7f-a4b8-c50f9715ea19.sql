-- 1. Create customer_roles table for custom contact roles
CREATE TABLE IF NOT EXISTS public.customer_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_roles ENABLE ROW LEVEL SECURITY;

-- Public read access for roles
CREATE POLICY "Anyone can view customer roles" ON public.customer_roles
  FOR SELECT USING (true);

-- Authenticated users can insert new roles
CREATE POLICY "Authenticated users can create roles" ON public.customer_roles
  FOR INSERT WITH CHECK (true);

-- Authenticated users can update roles
CREATE POLICY "Authenticated users can update roles" ON public.customer_roles
  FOR UPDATE USING (true);

-- Authenticated users can delete roles
CREATE POLICY "Authenticated users can delete roles" ON public.customer_roles
  FOR DELETE USING (true);

-- Seed default roles
INSERT INTO public.customer_roles (role_name) VALUES 
  ('Owner'),
  ('Manager'),
  ('Cashier'),
  ('Family Member'),
  ('Worker'),
  ('Buyer'),
  ('Decision Maker')
ON CONFLICT (role_name) DO NOTHING;