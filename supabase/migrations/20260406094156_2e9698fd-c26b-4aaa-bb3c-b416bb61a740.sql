
ALTER TABLE public.beauty_providers
  ADD COLUMN availability_status TEXT NOT NULL DEFAULT 'available'
    CHECK (availability_status IN ('available','busy','offline'));

CREATE INDEX idx_beauty_providers_availability ON public.beauty_providers(availability_status);

DROP FUNCTION IF EXISTS public.match_beauty_providers_by_location(double precision, double precision, text, double precision);

CREATE FUNCTION public.match_beauty_providers_by_location(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_category TEXT DEFAULT NULL,
  p_max_distance DOUBLE PRECISION DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  city TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  rating NUMERIC,
  service_radius_miles NUMERIC,
  distance_miles DOUBLE PRECISION,
  availability_status TEXT,
  total_bookings BIGINT,
  is_featured BOOLEAN,
  is_priority BOOLEAN,
  verification_status TEXT
) AS $$
  SELECT
    bp.id, bp.name, bp.category, bp.city, bp.lat, bp.lng,
    bp.rating, bp.service_radius_miles,
    public.calculate_distance_miles(p_lat, p_lng, bp.lat, bp.lng),
    bp.availability_status,
    COALESCE(bb.cnt, 0),
    COALESCE(bl.is_featured, false),
    COALESCE(bl.is_priority, false),
    bp.verification_status
  FROM public.beauty_providers bp
  LEFT JOIN (
    SELECT provider_id, COUNT(*) AS cnt FROM public.beauty_bookings WHERE status = 'completed' GROUP BY provider_id
  ) bb ON bb.provider_id = bp.id
  LEFT JOIN public.beauty_provider_listings bl ON bl.provider_id = bp.id
  WHERE bp.is_active = true
    AND bp.verification_status = 'verified'
    AND public.calculate_distance_miles(p_lat, p_lng, bp.lat, bp.lng) <= LEAST(bp.service_radius_miles, p_max_distance)
    AND (p_category IS NULL OR bp.category = p_category)
  ORDER BY
    CASE bp.availability_status WHEN 'available' THEN 0 WHEN 'busy' THEN 1 ELSE 2 END,
    COALESCE(bl.is_featured, false) DESC,
    bp.rating DESC NULLS LAST,
    COALESCE(bb.cnt, 0) DESC;
$$ LANGUAGE sql STABLE;

CREATE FUNCTION public.match_beauty_provider_media(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_max_distance DOUBLE PRECISION DEFAULT 50,
  p_media_type TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL
)
RETURNS TABLE (
  media_id UUID,
  provider_id UUID,
  provider_name TEXT,
  media_type TEXT,
  url TEXT,
  provider_category TEXT,
  distance_miles DOUBLE PRECISION
) AS $$
  SELECT
    pm.id, bp.id, bp.name, pm.media_type, pm.url, bp.category,
    public.calculate_distance_miles(p_lat, p_lng, bp.lat, bp.lng)
  FROM public.provider_media pm
  JOIN public.beauty_providers bp ON bp.id = pm.provider_id
  WHERE bp.is_active = true
    AND bp.verification_status = 'verified'
    AND public.calculate_distance_miles(p_lat, p_lng, bp.lat, bp.lng) <= LEAST(bp.service_radius_miles, p_max_distance)
    AND (p_media_type IS NULL OR pm.media_type = p_media_type)
    AND (p_category IS NULL OR bp.category = p_category)
  ORDER BY public.calculate_distance_miles(p_lat, p_lng, bp.lat, bp.lng);
$$ LANGUAGE sql STABLE;
