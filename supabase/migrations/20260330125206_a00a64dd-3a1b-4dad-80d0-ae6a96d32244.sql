
CREATE TABLE public.event_halls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  address text,
  city text,
  state text,
  zip_code text,
  phone text,
  email text,
  website text,
  capacity_min int,
  capacity_max int,
  price_per_hour numeric,
  price_per_event numeric,
  photos text[] DEFAULT '{}',
  amenities text[] DEFAULT '{}',
  event_types text[] DEFAULT '{}',
  rules text,
  parking_info text,
  catering_options text,
  views_count int DEFAULT 0,
  rating_avg numeric DEFAULT 0,
  review_count int DEFAULT 0,
  status text DEFAULT 'pending',
  is_featured boolean DEFAULT false,
  latitude numeric,
  longitude numeric,
  availability jsonb DEFAULT '{}',
  contact_name text,
  instagram_handle text,
  facebook_url text
);

CREATE TABLE public.staff_members_ut (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  bio text,
  role_category text,
  specialties text[] DEFAULT '{}',
  city text,
  state text,
  hourly_rate numeric,
  event_rate numeric,
  profile_photo text,
  portfolio_photos text[] DEFAULT '{}',
  portfolio_videos text[] DEFAULT '{}',
  demo_video_url text,
  views_count int DEFAULT 0,
  rating_avg numeric DEFAULT 0,
  review_count int DEFAULT 0,
  status text DEFAULT 'pending',
  is_featured boolean DEFAULT false,
  years_experience int,
  languages text[] DEFAULT '{}',
  availability jsonb DEFAULT '{}',
  total_bookings int DEFAULT 0,
  total_earnings numeric DEFAULT 0,
  instagram_handle text,
  tiktok_handle text,
  website text
);

CREATE TABLE public.hall_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  hall_id uuid REFERENCES public.event_halls(id) ON DELETE CASCADE NOT NULL,
  requester_name text NOT NULL,
  requester_email text,
  requester_phone text,
  event_date date,
  event_type text,
  guest_count int,
  budget numeric,
  message text,
  status text DEFAULT 'pending',
  reply text,
  replied_at timestamptz,
  notes text
);

CREATE TABLE public.staff_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  staff_id uuid REFERENCES public.staff_members_ut(id) ON DELETE CASCADE NOT NULL,
  requester_name text NOT NULL,
  requester_email text,
  requester_phone text,
  event_date date,
  event_type text,
  guest_count int,
  budget numeric,
  message text,
  status text DEFAULT 'pending',
  reply text,
  replied_at timestamptz,
  hours_needed int,
  notes text
);

CREATE TABLE public.hall_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  hall_id uuid REFERENCES public.event_halls(id) ON DELETE CASCADE NOT NULL,
  reviewer_name text NOT NULL,
  rating int NOT NULL,
  body text,
  reply text,
  replied_at timestamptz
);

CREATE TABLE public.staff_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  staff_id uuid REFERENCES public.staff_members_ut(id) ON DELETE CASCADE NOT NULL,
  reviewer_name text NOT NULL,
  rating int NOT NULL,
  body text,
  reply text,
  replied_at timestamptz
);

ALTER TABLE public.event_halls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_members_ut ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hall_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hall_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read halls" ON public.event_halls FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners update halls" ON public.event_halls FOR UPDATE TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY "Authenticated insert halls" ON public.event_halls FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated read staff_ut" ON public.staff_members_ut FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff update own" ON public.staff_members_ut FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Authenticated insert staff_ut" ON public.staff_members_ut FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Read hall_inquiries" ON public.hall_inquiries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert hall_inquiries" ON public.hall_inquiries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Update hall_inquiries" ON public.hall_inquiries FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Read staff_inquiries" ON public.staff_inquiries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert staff_inquiries" ON public.staff_inquiries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Update staff_inquiries" ON public.staff_inquiries FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Read hall_reviews" ON public.hall_reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert hall_reviews" ON public.hall_reviews FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Update hall_reviews" ON public.hall_reviews FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Read staff_reviews" ON public.staff_reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert staff_reviews" ON public.staff_reviews FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Update staff_reviews" ON public.staff_reviews FOR UPDATE TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.hall_inquiries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_inquiries;
