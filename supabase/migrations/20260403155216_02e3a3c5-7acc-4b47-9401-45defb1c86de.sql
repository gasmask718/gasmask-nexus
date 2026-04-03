
CREATE TABLE public.tt_vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'exotic_car',
  image_url TEXT,
  gallery_images JSONB DEFAULT '[]'::jsonb,
  base_price NUMERIC,
  daily_rate NUMERIC,
  description TEXT,
  location TEXT,
  year INTEGER,
  make TEXT,
  model TEXT,
  color TEXT,
  plate_number TEXT,
  seats INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  featured BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tt_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active vehicles"
  ON public.tt_vehicles FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert vehicles"
  ON public.tt_vehicles FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update vehicles"
  ON public.tt_vehicles FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete vehicles"
  ON public.tt_vehicles FOR DELETE
  TO authenticated
  USING (true);
