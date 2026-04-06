
-- Add geolocation columns
ALTER TABLE public.decor_providers
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS service_radius_miles INTEGER DEFAULT 25;

ALTER TABLE public.experience_providers
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS service_radius_miles INTEGER DEFAULT 30;

ALTER TABLE public.fleet_vehicles
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- Provider locations table
CREATE TABLE IF NOT EXISTS public.provider_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('decor', 'experience')),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  address TEXT,
  city TEXT,
  is_primary BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.provider_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Provider locations are publicly readable"
  ON public.provider_locations FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage provider locations"
  ON public.provider_locations FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_provider_locations_provider ON public.provider_locations(provider_id, provider_type);
CREATE INDEX idx_provider_locations_coords ON public.provider_locations(lat, lng);
CREATE INDEX idx_decor_providers_coords ON public.decor_providers(lat, lng);
CREATE INDEX idx_experience_providers_coords ON public.experience_providers(lat, lng);
CREATE INDEX idx_fleet_vehicles_coords ON public.fleet_vehicles(lat, lng);

-- Haversine distance function (miles)
CREATE OR REPLACE FUNCTION public.calculate_distance_miles(
  lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION
LANGUAGE sql IMMUTABLE
AS $$
  SELECT 3959.0 * acos(
    LEAST(1.0,
      cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2) - radians(lng1))
      + sin(radians(lat1)) * sin(radians(lat2))
    )
  )
$$;

-- Match providers by location (plpgsql to avoid column resolution issue)
CREATE OR REPLACE FUNCTION public.match_providers_by_location(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_category TEXT DEFAULT NULL
) RETURNS TABLE (
  provider_id UUID,
  provider_name TEXT,
  provider_type TEXT,
  city TEXT,
  distance_miles DOUBLE PRECISION,
  service_radius INTEGER
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM (
    SELECT
      dp.id AS provider_id,
      dp.name AS provider_name,
      'decor'::TEXT AS provider_type,
      dp.city,
      public.calculate_distance_miles(p_lat, p_lng, dp.lat, dp.lng) AS distance_miles,
      dp.service_radius_miles AS service_radius
    FROM public.decor_providers dp
    WHERE dp.is_active = true
      AND dp.lat IS NOT NULL AND dp.lng IS NOT NULL
      AND public.calculate_distance_miles(p_lat, p_lng, dp.lat, dp.lng) <= dp.service_radius_miles
      AND (p_category IS NULL OR 'decor' = p_category)

    UNION ALL

    SELECT
      ep.id,
      ep.name,
      'experience'::TEXT,
      ep.city,
      public.calculate_distance_miles(p_lat, p_lng, ep.lat, ep.lng),
      ep.service_radius_miles
    FROM public.experience_providers ep
    WHERE ep.is_active = true
      AND ep.lat IS NOT NULL AND ep.lng IS NOT NULL
      AND public.calculate_distance_miles(p_lat, p_lng, ep.lat, ep.lng) <= ep.service_radius_miles
      AND (p_category IS NULL OR ep.category = p_category)
  ) sub
  ORDER BY sub.distance_miles ASC;
END;
$$;

-- Match vehicles by location
CREATE OR REPLACE FUNCTION public.match_vehicles_by_location(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_max_distance DOUBLE PRECISION DEFAULT 50
) RETURNS TABLE (
  vehicle_id UUID,
  vehicle_name TEXT,
  category TEXT,
  city TEXT,
  distance_miles DOUBLE PRECISION,
  available_for_decor BOOLEAN,
  available_for_chauffeur BOOLEAN,
  available_for_nightlife BOOLEAN
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fv.id AS vehicle_id,
    fv.name AS vehicle_name,
    fv.category,
    fv.city,
    public.calculate_distance_miles(p_lat, p_lng, fv.lat, fv.lng) AS distance_miles,
    fv.available_for_decor,
    fv.available_for_chauffeur,
    fv.available_for_nightlife
  FROM public.fleet_vehicles fv
  WHERE fv.is_active = true
    AND fv.lat IS NOT NULL AND fv.lng IS NOT NULL
    AND public.calculate_distance_miles(p_lat, p_lng, fv.lat, fv.lng) <= p_max_distance
  ORDER BY distance_miles ASC;
END;
$$;
