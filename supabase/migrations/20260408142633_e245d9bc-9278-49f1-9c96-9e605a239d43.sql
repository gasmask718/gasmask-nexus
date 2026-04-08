
-- Table 1: venue_virtual_tours
CREATE TABLE public.venue_virtual_tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID,
  tour_type TEXT NOT NULL DEFAULT 'google' CHECK (tour_type IN ('google', 'matterport', 'video')),
  tour_url TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.venue_virtual_tours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage venue_virtual_tours" ON public.venue_virtual_tours FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table 2: virtual_tour_requests
CREATE TABLE public.virtual_tour_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID,
  venue_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  venue_size TEXT,
  venue_type TEXT,
  preferred_date DATE,
  budget_range TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')),
  assigned_photographer_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.virtual_tour_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage virtual_tour_requests" ON public.virtual_tour_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table 3: photographers
CREATE TABLE public.photographers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  service_area TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_miles INTEGER NOT NULL DEFAULT 25,
  equipment_type TEXT NOT NULL DEFAULT '360_camera' CHECK (equipment_type IN ('360_camera', 'matterport', 'video')),
  rating NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  jobs_completed INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.photographers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage photographers" ON public.photographers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table 4: photographer_jobs
CREATE TABLE public.photographer_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.virtual_tour_requests(id) ON DELETE CASCADE,
  photographer_id UUID NOT NULL REFERENCES public.photographers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'accepted', 'en_route', 'completed', 'rejected')),
  price NUMERIC(10,2),
  commission_amount NUMERIC(10,2),
  photographer_payout NUMERIC(10,2),
  payout_status TEXT NOT NULL DEFAULT 'pending' CHECK (payout_status IN ('pending', 'processing', 'paid')),
  scheduled_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  tour_url TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.photographer_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage photographer_jobs" ON public.photographer_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Foreign key from requests to photographers
ALTER TABLE public.virtual_tour_requests
  ADD CONSTRAINT virtual_tour_requests_photographer_fkey
  FOREIGN KEY (assigned_photographer_id) REFERENCES public.photographers(id);

-- Indexes for geo queries and lookups
CREATE INDEX idx_photographers_location ON public.photographers (lat, lng);
CREATE INDEX idx_photographers_active ON public.photographers (is_active);
CREATE INDEX idx_virtual_tour_requests_status ON public.virtual_tour_requests (status);
CREATE INDEX idx_photographer_jobs_status ON public.photographer_jobs (status);
CREATE INDEX idx_photographer_jobs_photographer ON public.photographer_jobs (photographer_id);

-- Haversine distance function for photographer matching
CREATE OR REPLACE FUNCTION public.match_photographers_by_location(
  req_lat DOUBLE PRECISION,
  req_lng DOUBLE PRECISION,
  equipment TEXT DEFAULT NULL
)
RETURNS TABLE (
  photographer_id UUID,
  photographer_name TEXT,
  distance_miles DOUBLE PRECISION,
  photographer_rating NUMERIC,
  photographer_equipment TEXT,
  photographer_jobs_completed INTEGER
)
LANGUAGE sql STABLE
AS $$
  SELECT
    p.id,
    p.name,
    3959 * ACOS(
      COS(RADIANS(req_lat)) * COS(RADIANS(p.lat)) *
      COS(RADIANS(p.lng) - RADIANS(req_lng)) +
      SIN(RADIANS(req_lat)) * SIN(RADIANS(p.lat))
    ) AS distance_miles,
    p.rating,
    p.equipment_type,
    p.jobs_completed
  FROM public.photographers p
  WHERE p.is_active = true
    AND p.lat IS NOT NULL
    AND p.lng IS NOT NULL
    AND (equipment IS NULL OR p.equipment_type = equipment)
    AND 3959 * ACOS(
      COS(RADIANS(req_lat)) * COS(RADIANS(p.lat)) *
      COS(RADIANS(p.lng) - RADIANS(req_lng)) +
      SIN(RADIANS(req_lat)) * SIN(RADIANS(p.lat))
    ) <= p.radius_miles
  ORDER BY distance_miles ASC, p.rating DESC, p.jobs_completed DESC;
$$;

-- Updated_at trigger for requests
CREATE OR REPLACE FUNCTION public.update_virtual_tour_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_virtual_tour_requests_updated_at
  BEFORE UPDATE ON public.virtual_tour_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_virtual_tour_requests_updated_at();
