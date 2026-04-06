
-- Add tags and before/after pairing to provider_media
ALTER TABLE public.provider_media
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS before_after_pair_id UUID,
  ADD COLUMN IF NOT EXISTS is_before BOOLEAN;

CREATE INDEX IF NOT EXISTS idx_provider_media_tags ON public.provider_media USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_provider_media_pair ON public.provider_media(before_after_pair_id) WHERE before_after_pair_id IS NOT NULL;

-- Availability schedule table
CREATE TABLE IF NOT EXISTS public.provider_availability_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES public.beauty_providers(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider_id, day_of_week)
);

ALTER TABLE public.provider_availability_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view availability"
  ON public.provider_availability_schedule FOR SELECT USING (true);

CREATE POLICY "Providers manage own availability"
  ON public.provider_availability_schedule FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.beauty_providers bp WHERE bp.id = provider_id AND bp.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.beauty_providers bp WHERE bp.id = provider_id AND bp.user_id = auth.uid())
  );

CREATE INDEX idx_provider_avail_provider ON public.provider_availability_schedule(provider_id);

-- Update match function to include availability schedule data
DROP FUNCTION IF EXISTS public.get_provider_profile_data(UUID);

CREATE FUNCTION public.get_provider_profile_data(p_provider_id UUID)
RETURNS JSON AS $$
  SELECT json_build_object(
    'provider', row_to_json(bp.*),
    'services', COALESCE((SELECT json_agg(row_to_json(ps.*)) FROM public.provider_services ps WHERE ps.provider_id = p_provider_id), '[]'::json),
    'media', COALESCE((SELECT json_agg(row_to_json(pm.*) ORDER BY pm.created_at DESC) FROM public.provider_media pm WHERE pm.provider_id = p_provider_id), '[]'::json),
    'schedule', COALESCE((SELECT json_agg(row_to_json(pa.*) ORDER BY pa.day_of_week) FROM public.provider_availability_schedule pa WHERE pa.provider_id = p_provider_id), '[]'::json),
    'reviews', COALESCE((SELECT json_agg(row_to_json(pr.*) ORDER BY pr.created_at DESC) FROM public.provider_reviews pr WHERE pr.provider_id = p_provider_id), '[]'::json),
    'booking_count', (SELECT COUNT(*) FROM public.beauty_bookings bb WHERE bb.provider_id = p_provider_id AND bb.status = 'completed'),
    'listing', (SELECT row_to_json(bl.*) FROM public.beauty_provider_listings bl WHERE bl.provider_id = p_provider_id)
  )
  FROM public.beauty_providers bp
  WHERE bp.id = p_provider_id;
$$ LANGUAGE sql STABLE;
