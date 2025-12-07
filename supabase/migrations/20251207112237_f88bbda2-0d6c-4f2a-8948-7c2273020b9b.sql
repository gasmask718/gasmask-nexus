-- Create boroughs table
CREATE TABLE IF NOT EXISTS public.boroughs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.boroughs ENABLE ROW LEVEL SECURITY;

-- RLS Policies - allow all authenticated users to read boroughs
CREATE POLICY "Anyone can view boroughs" ON public.boroughs
  FOR SELECT USING (true);

-- Allow authenticated users to insert boroughs
CREATE POLICY "Authenticated users can create boroughs" ON public.boroughs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Add borough_id to crm_contacts if not exists
ALTER TABLE public.crm_contacts 
  ADD COLUMN IF NOT EXISTS borough_id UUID REFERENCES public.boroughs(id);

-- Insert default NYC boroughs
INSERT INTO public.boroughs (name) VALUES
  ('Brooklyn'),
  ('Bronx'),
  ('Manhattan'),
  ('Queens'),
  ('Staten Island')
ON CONFLICT (name) DO NOTHING;