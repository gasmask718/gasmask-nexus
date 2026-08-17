ALTER TABLE public.staff_members_ut
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

COMMENT ON COLUMN public.staff_members_ut.latitude IS 'Geocoded latitude from UT signup. Nullable, no default: absent when address geocoding does not resolve. Never fabricate 0.';
COMMENT ON COLUMN public.staff_members_ut.longitude IS 'Geocoded longitude from UT signup. Nullable, no default: absent when address geocoding does not resolve. Never fabricate 0.';

-- Promote any real coordinate values already absorbed into mirror_extra, then strip those keys.
UPDATE public.staff_members_ut
SET latitude = COALESCE(latitude, NULLIF(mirror_extra->>'latitude','')::numeric),
    longitude = COALESCE(longitude, NULLIF(mirror_extra->>'longitude','')::numeric),
    mirror_extra = mirror_extra - 'latitude' - 'longitude'
WHERE mirror_extra ?| array['latitude','longitude'];