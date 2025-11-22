-- Create wholesale_hubs table
CREATE TABLE public.wholesale_hubs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address_street TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  lat NUMERIC,
  lng NUMERIC,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  products_available TEXT[],
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wholesale_hubs ENABLE ROW LEVEL SECURITY;

-- Anyone can view wholesale hubs
CREATE POLICY "Anyone can view wholesale hubs"
ON public.wholesale_hubs
FOR SELECT
USING (true);

-- Admins can manage wholesale hubs
CREATE POLICY "Admins can manage wholesale hubs"
ON public.wholesale_hubs
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_wholesale_hubs_updated_at
BEFORE UPDATE ON public.wholesale_hubs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();