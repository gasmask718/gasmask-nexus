
-- ============================================
-- MEDIA CREATORS: ADD PROFILE PAGE FIELDS
-- ============================================

ALTER TABLE public.media_creators
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS provider_type TEXT DEFAULT 'photographer',
  ADD COLUMN IF NOT EXISTS service_area TEXT,
  ADD COLUMN IF NOT EXISTS half_day_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS full_day_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS response_time_hours NUMERIC DEFAULT 2,
  ADD COLUMN IF NOT EXISTS total_jobs INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS years_experience INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS portfolio_images TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS portfolio_videos TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cover_image TEXT,
  ADD COLUMN IF NOT EXISTS same_day_edit_available BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS drone_available BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS editing_available BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS travel_radius_miles NUMERIC DEFAULT 25,
  ADD COLUMN IF NOT EXISTS instagram_handle TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Rename existing columns for consistency
-- profile_image_url -> profile_image (alias via display, keep column)
-- service_radius_miles already exists as travel substitute

CREATE INDEX IF NOT EXISTS idx_media_creators_slug ON public.media_creators(slug);
CREATE INDEX IF NOT EXISTS idx_media_creators_provider_type ON public.media_creators(provider_type);
CREATE INDEX IF NOT EXISTS idx_media_creators_city_available ON public.media_creators(city, is_available);
CREATE INDEX IF NOT EXISTS idx_media_creators_specialties ON public.media_creators USING GIN(specialties);

-- Slug generator function
CREATE OR REPLACE FUNCTION public.generate_creator_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  IF NEW.slug IS NOT NULL AND NEW.slug != '' THEN
    RETURN NEW;
  END IF;

  base_slug := lower(regexp_replace(COALESCE(NEW.display_name, NEW.full_name), '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  final_slug := base_slug;

  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.media_creators WHERE slug = final_slug AND id != NEW.id);
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  NEW.slug := final_slug;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_media_creators_slug
  BEFORE INSERT OR UPDATE OF display_name, full_name ON public.media_creators
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_creator_slug();

-- ============================================
-- MEDIA CREATOR REVIEWS
-- ============================================

CREATE TABLE public.media_creator_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.media_creators(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.media_bookings(id) ON DELETE SET NULL,
  client_user_id UUID NOT NULL,
  rating NUMERIC NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  event_type TEXT,
  creator_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.media_creator_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews"
  ON public.media_creator_reviews FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users can create reviews for own bookings"
  ON public.media_creator_reviews FOR INSERT
  TO authenticated WITH CHECK (client_user_id = auth.uid());

CREATE POLICY "Creators can respond to their reviews"
  ON public.media_creator_reviews FOR UPDATE
  TO authenticated USING (
    creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid())
  );

CREATE INDEX idx_reviews_creator ON public.media_creator_reviews(creator_id);
CREATE INDEX idx_reviews_rating ON public.media_creator_reviews(rating);

-- ============================================
-- MEDIA CREATOR PROJECTS (PORTFOLIO)
-- ============================================

CREATE TABLE public.media_creator_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.media_creators(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT,
  media_type TEXT NOT NULL DEFAULT 'image',
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  is_featured BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.media_creator_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view projects"
  ON public.media_creator_projects FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Creators can manage own projects"
  ON public.media_creator_projects FOR ALL
  TO authenticated USING (
    creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid())
  );

CREATE INDEX idx_projects_creator ON public.media_creator_projects(creator_id);
CREATE INDEX idx_projects_featured ON public.media_creator_projects(is_featured);

-- ============================================
-- MEDIA CREATOR FAVORITES
-- ============================================

CREATE TABLE public.media_creator_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  creator_id UUID NOT NULL REFERENCES public.media_creators(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, creator_id)
);

ALTER TABLE public.media_creator_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own favorites"
  ON public.media_creator_favorites FOR ALL
  TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_favorites_user ON public.media_creator_favorites(user_id);
CREATE INDEX idx_favorites_creator ON public.media_creator_favorites(creator_id);
