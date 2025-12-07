-- Create neighborhoods table
CREATE TABLE IF NOT EXISTS public.neighborhoods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  borough_id UUID NOT NULL REFERENCES public.boroughs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(borough_id, name)
);

-- Enable RLS
ALTER TABLE public.neighborhoods ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Neighborhoods are viewable by authenticated users" 
ON public.neighborhoods 
FOR SELECT 
TO authenticated
USING (true);

-- Allow insert for authenticated users
CREATE POLICY "Authenticated users can create neighborhoods" 
ON public.neighborhoods 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Add borough_id and neighborhood_id to brand_crm_contacts if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brand_crm_contacts' AND column_name = 'borough_id') THEN
    ALTER TABLE public.brand_crm_contacts ADD COLUMN borough_id UUID REFERENCES public.boroughs(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brand_crm_contacts' AND column_name = 'neighborhood_id') THEN
    ALTER TABLE public.brand_crm_contacts ADD COLUMN neighborhood_id UUID REFERENCES public.neighborhoods(id);
  END IF;
END $$;

-- Insert default neighborhoods for each borough
INSERT INTO public.neighborhoods (borough_id, name) VALUES
-- Brooklyn
((SELECT id FROM public.boroughs WHERE name = 'Brooklyn'), 'Bushwick'),
((SELECT id FROM public.boroughs WHERE name = 'Brooklyn'), 'Williamsburg'),
((SELECT id FROM public.boroughs WHERE name = 'Brooklyn'), 'Flatbush'),
((SELECT id FROM public.boroughs WHERE name = 'Brooklyn'), 'East New York'),
((SELECT id FROM public.boroughs WHERE name = 'Brooklyn'), 'Canarsie'),
((SELECT id FROM public.boroughs WHERE name = 'Brooklyn'), 'Bedford-Stuyvesant'),
((SELECT id FROM public.boroughs WHERE name = 'Brooklyn'), 'Crown Heights'),
((SELECT id FROM public.boroughs WHERE name = 'Brooklyn'), 'Brownsville'),
((SELECT id FROM public.boroughs WHERE name = 'Brooklyn'), 'Sunset Park'),
((SELECT id FROM public.boroughs WHERE name = 'Brooklyn'), 'Bay Ridge'),
-- Bronx
((SELECT id FROM public.boroughs WHERE name = 'Bronx'), 'Fordham'),
((SELECT id FROM public.boroughs WHERE name = 'Bronx'), 'Tremont'),
((SELECT id FROM public.boroughs WHERE name = 'Bronx'), 'Hunts Point'),
((SELECT id FROM public.boroughs WHERE name = 'Bronx'), 'Mott Haven'),
((SELECT id FROM public.boroughs WHERE name = 'Bronx'), 'Highbridge'),
((SELECT id FROM public.boroughs WHERE name = 'Bronx'), 'University Heights'),
((SELECT id FROM public.boroughs WHERE name = 'Bronx'), 'Morris Heights'),
((SELECT id FROM public.boroughs WHERE name = 'Bronx'), 'Concourse'),
-- Manhattan
((SELECT id FROM public.boroughs WHERE name = 'Manhattan'), 'Harlem'),
((SELECT id FROM public.boroughs WHERE name = 'Manhattan'), 'Washington Heights'),
((SELECT id FROM public.boroughs WHERE name = 'Manhattan'), 'Inwood'),
((SELECT id FROM public.boroughs WHERE name = 'Manhattan'), 'East Harlem'),
((SELECT id FROM public.boroughs WHERE name = 'Manhattan'), 'Lower East Side'),
((SELECT id FROM public.boroughs WHERE name = 'Manhattan'), 'Midtown'),
((SELECT id FROM public.boroughs WHERE name = 'Manhattan'), 'Chelsea'),
((SELECT id FROM public.boroughs WHERE name = 'Manhattan'), 'Tribeca'),
-- Queens
((SELECT id FROM public.boroughs WHERE name = 'Queens'), 'Jamaica'),
((SELECT id FROM public.boroughs WHERE name = 'Queens'), 'Flushing'),
((SELECT id FROM public.boroughs WHERE name = 'Queens'), 'Astoria'),
((SELECT id FROM public.boroughs WHERE name = 'Queens'), 'Jackson Heights'),
((SELECT id FROM public.boroughs WHERE name = 'Queens'), 'Long Island City'),
((SELECT id FROM public.boroughs WHERE name = 'Queens'), 'Corona'),
((SELECT id FROM public.boroughs WHERE name = 'Queens'), 'Elmhurst'),
((SELECT id FROM public.boroughs WHERE name = 'Queens'), 'Woodside'),
-- Staten Island
((SELECT id FROM public.boroughs WHERE name = 'Staten Island'), 'St. George'),
((SELECT id FROM public.boroughs WHERE name = 'Staten Island'), 'Tompkinsville'),
((SELECT id FROM public.boroughs WHERE name = 'Staten Island'), 'Port Richmond'),
((SELECT id FROM public.boroughs WHERE name = 'Staten Island'), 'New Brighton')
ON CONFLICT (borough_id, name) DO NOTHING;