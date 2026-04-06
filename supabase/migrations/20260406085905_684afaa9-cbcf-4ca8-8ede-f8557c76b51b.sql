
-- Personal photos for decor bookings
CREATE TABLE public.decor_personal_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.decor_bookings(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_feature BOOLEAN NOT NULL DEFAULT false,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.decor_personal_photos ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_decor_personal_photos_booking ON public.decor_personal_photos(booking_id);

CREATE POLICY "Users can view photos for their bookings"
  ON public.decor_personal_photos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can upload photos"
  ON public.decor_personal_photos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can update their photos"
  ON public.decor_personal_photos FOR UPDATE TO authenticated
  USING (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete their photos"
  ON public.decor_personal_photos FOR DELETE TO authenticated
  USING (auth.uid() = uploaded_by);

-- Photo display preferences per booking
CREATE TABLE public.decor_photo_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.decor_bookings(id) ON DELETE CASCADE,
  display_style TEXT NOT NULL DEFAULT 'framed',
  caption_text TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.decor_photo_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their preferences"
  ON public.decor_photo_preferences FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create preferences"
  ON public.decor_photo_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update preferences"
  ON public.decor_photo_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete preferences"
  ON public.decor_photo_preferences FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_decor_photo_preferences_updated_at
  BEFORE UPDATE ON public.decor_photo_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
