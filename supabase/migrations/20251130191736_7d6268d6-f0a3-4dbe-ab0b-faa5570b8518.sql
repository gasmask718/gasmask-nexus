-- Create roles table
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read roles
CREATE POLICY "Roles are viewable by authenticated users" 
ON public.roles 
FOR SELECT 
TO authenticated
USING (true);

-- Only admins can manage roles
CREATE POLICY "Admins can manage roles" 
ON public.roles 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Insert default roles
INSERT INTO public.roles (name, description) VALUES
  ('admin', 'Full system administrator'),
  ('employee', 'Internal staff member'),
  ('driver', 'Delivery driver'),
  ('biker', 'Delivery biker'),
  ('store', 'Retail store partner'),
  ('wholesale', 'Wholesale partner'),
  ('wholesaler', 'Wholesaler'),
  ('warehouse', 'Warehouse staff'),
  ('influencer', 'Social media influencer'),
  ('ambassador', 'Brand ambassador'),
  ('customer', 'End customer'),
  ('csr', 'Customer service representative'),
  ('accountant', 'Financial accountant')
ON CONFLICT (name) DO NOTHING;