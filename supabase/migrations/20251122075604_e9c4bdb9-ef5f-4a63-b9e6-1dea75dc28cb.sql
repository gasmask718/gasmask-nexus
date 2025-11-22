-- Create routes_generated table
CREATE TABLE public.routes_generated (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  driver_id UUID REFERENCES public.profiles(id),
  stops JSONB NOT NULL DEFAULT '[]'::jsonb,
  distance_km NUMERIC,
  estimated_minutes INTEGER,
  ai_confidence_score NUMERIC,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create route_checkins table
CREATE TABLE public.route_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID REFERENCES public.routes_generated(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id),
  driver_id UUID REFERENCES public.profiles(id),
  checkin_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  photos TEXT[] DEFAULT ARRAY[]::TEXT[],
  latitude NUMERIC,
  longitude NUMERIC,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.routes_generated ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_checkins ENABLE ROW LEVEL SECURITY;

-- RLS Policies for routes_generated
CREATE POLICY "Admins can manage routes"
  ON public.routes_generated
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Drivers can view their routes"
  ON public.routes_generated
  FOR SELECT
  USING (
    driver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'csr')
    )
  );

-- RLS Policies for route_checkins
CREATE POLICY "Drivers can manage their checkins"
  ON public.route_checkins
  FOR ALL
  USING (
    driver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'csr')
    )
  );

CREATE POLICY "Anyone can view checkins"
  ON public.route_checkins
  FOR SELECT
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_routes_generated_updated_at
  BEFORE UPDATE ON public.routes_generated
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_routes_generated_driver ON public.routes_generated(driver_id);
CREATE INDEX idx_routes_generated_date ON public.routes_generated(date);
CREATE INDEX idx_route_checkins_route ON public.route_checkins(route_id);
CREATE INDEX idx_route_checkins_driver ON public.route_checkins(driver_id);
CREATE INDEX idx_route_checkins_store ON public.route_checkins(store_id);