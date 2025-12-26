-- 1. Create Staff Categories Table (does not exist)
CREATE TABLE public.ut_staff_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_slug TEXT NOT NULL DEFAULT 'unforgettable_times_usa',
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(business_slug, name)
);

-- Enable RLS
ALTER TABLE public.ut_staff_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active staff categories"
  ON public.ut_staff_categories FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage staff categories"
  ON public.ut_staff_categories FOR ALL USING (true) WITH CHECK (true);

-- Seed default categories
INSERT INTO public.ut_staff_categories (business_slug, name, description) VALUES
  ('unforgettable_times_usa', 'Security', 'Event security personnel'),
  ('unforgettable_times_usa', 'Decorators', 'Event decoration specialists'),
  ('unforgettable_times_usa', 'Bartenders', 'Beverage service professionals'),
  ('unforgettable_times_usa', 'Host', 'Event hosts and hostesses'),
  ('unforgettable_times_usa', 'Costume Wearers', 'Character performers and mascots'),
  ('unforgettable_times_usa', 'Magicians', 'Magic and illusion performers'),
  ('unforgettable_times_usa', 'Clowns', 'Clown entertainers'),
  ('unforgettable_times_usa', 'Private Chefs', 'Personal and event chefs'),
  ('unforgettable_times_usa', 'Catering Crews', 'Catering service teams'),
  ('unforgettable_times_usa', 'DJ', 'Disc jockeys and music entertainment'),
  ('unforgettable_times_usa', 'MC/Emcee', 'Masters of ceremony'),
  ('unforgettable_times_usa', 'Photographer', 'Event photographers'),
  ('unforgettable_times_usa', 'Videographer', 'Event videographers'),
  ('unforgettable_times_usa', 'Server', 'Food and beverage servers'),
  ('unforgettable_times_usa', 'Setup Crew', 'Event setup and breakdown crews'),
  ('unforgettable_times_usa', 'Valet', 'Valet parking attendants'),
  ('unforgettable_times_usa', 'Event Coordinator', 'Event coordination staff'),
  ('unforgettable_times_usa', 'Lighting Technician', 'Lighting and AV technicians'),
  ('unforgettable_times_usa', 'Sound Engineer', 'Audio and sound professionals');

-- 2. Add missing columns to ut_staff table
ALTER TABLE public.ut_staff 
  ADD COLUMN IF NOT EXISTS dob DATE,
  ADD COLUMN IF NOT EXISTS address_line_1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line_2 TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zip TEXT,
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.ut_staff_categories(id),
  ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT DEFAULT 'call',
  ADD COLUMN IF NOT EXISTS pay_type TEXT DEFAULT 'hourly',
  ADD COLUMN IF NOT EXISTS pay_rate DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS availability_notes TEXT,
  ADD COLUMN IF NOT EXISTS business_slug TEXT DEFAULT 'unforgettable_times_usa';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ut_staff_category_id ON public.ut_staff(category_id);
CREATE INDEX IF NOT EXISTS idx_ut_staff_state ON public.ut_staff(state);
CREATE INDEX IF NOT EXISTS idx_ut_staff_categories_business_slug ON public.ut_staff_categories(business_slug);