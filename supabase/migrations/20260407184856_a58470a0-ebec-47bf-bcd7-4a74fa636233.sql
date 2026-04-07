
-- ============================================================
-- 1. EXTEND media_creators (canonical source of truth)
-- ============================================================
ALTER TABLE public.media_creators
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS short_tagline text,
  ADD COLUMN IF NOT EXISTS signature_style text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS accepts_instant_bookings boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_scheduled_bookings boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS custom_quote_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS minimum_booking_hours numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS weekend_pricing_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS rush_booking_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS on_site_editing_available boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS multi_camera_available boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS assistant_team_available boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS repeat_client_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS average_delivery_hours numeric,
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS languages_spoken text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS public_badges text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS profile_visibility_status text DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS onboarding_status text DEFAULT 'pending';

-- Indexes for media_creators
CREATE INDEX IF NOT EXISTS idx_media_creators_slug ON public.media_creators(slug);
CREATE INDEX IF NOT EXISTS idx_media_creators_user_id ON public.media_creators(user_id);
CREATE INDEX IF NOT EXISTS idx_media_creators_city ON public.media_creators(city);
CREATE INDEX IF NOT EXISTS idx_media_creators_provider_type ON public.media_creators(provider_type);
CREATE INDEX IF NOT EXISTS idx_media_creators_is_available ON public.media_creators(is_available);
CREATE INDEX IF NOT EXISTS idx_media_creators_is_verified ON public.media_creators(is_verified);
CREATE INDEX IF NOT EXISTS idx_media_creators_visibility ON public.media_creators(profile_visibility_status);

-- ============================================================
-- 2. EXTEND media_bookings
-- ============================================================
ALTER TABLE public.media_bookings
  ADD COLUMN IF NOT EXISTS event_title text,
  ADD COLUMN IF NOT EXISTS requested_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS requested_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS location_text text,
  ADD COLUMN IF NOT EXISTS subtotal_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS addon_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rush_fee_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS travel_fee_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS creator_payout_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS deliverables_summary text,
  ADD COLUMN IF NOT EXISTS creator_notes text,
  ADD COLUMN IF NOT EXISTS client_notes text,
  ADD COLUMN IF NOT EXISTS quote_requested boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS instant_booking boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS booking_status text DEFAULT 'requested';

CREATE INDEX IF NOT EXISTS idx_media_bookings_creator ON public.media_bookings(creator_id);
CREATE INDEX IF NOT EXISTS idx_media_bookings_status ON public.media_bookings(booking_status);
CREATE INDEX IF NOT EXISTS idx_media_bookings_user ON public.media_bookings(user_id);

-- ============================================================
-- 3. EXTEND media_job_offers
-- ============================================================
ALTER TABLE public.media_job_offers
  ADD COLUMN IF NOT EXISTS offered_payout numeric,
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS location_text text,
  ADD COLUMN IF NOT EXISTS requested_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration_hours numeric,
  ADD COLUMN IF NOT EXISTS addon_summary text,
  ADD COLUMN IF NOT EXISTS client_notes text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_media_job_offers_creator ON public.media_job_offers(creator_id);
CREATE INDEX IF NOT EXISTS idx_media_job_offers_status ON public.media_job_offers(status);
CREATE INDEX IF NOT EXISTS idx_media_job_offers_expires ON public.media_job_offers(expires_at);

-- ============================================================
-- 4. EXTEND media_creator_projects
-- ============================================================
ALTER TABLE public.media_creator_projects
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS is_case_study boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_type text,
  ADD COLUMN IF NOT EXISTS turnaround_hours numeric,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_media_creator_projects_creator ON public.media_creator_projects(creator_id);
CREATE INDEX IF NOT EXISTS idx_media_creator_projects_category ON public.media_creator_projects(category);
CREATE INDEX IF NOT EXISTS idx_media_creator_projects_featured ON public.media_creator_projects(is_featured);
CREATE INDEX IF NOT EXISTS idx_media_creator_projects_public ON public.media_creator_projects(is_public);

-- ============================================================
-- 5. EXTEND media_creator_reviews
-- ============================================================
ALTER TABLE public.media_creator_reviews
  ADD COLUMN IF NOT EXISTS review_month int,
  ADD COLUMN IF NOT EXISTS review_year int,
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_media_creator_reviews_creator ON public.media_creator_reviews(creator_id);
CREATE INDEX IF NOT EXISTS idx_media_creator_reviews_booking ON public.media_creator_reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_media_creator_reviews_rating ON public.media_creator_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_media_creator_reviews_public ON public.media_creator_reviews(is_public);

-- ============================================================
-- 6. EXTEND media_creator_verification
-- ============================================================
ALTER TABLE public.media_creator_verification
  ADD COLUMN IF NOT EXISTS identity_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS equipment_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS payout_setup_complete boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_setup_complete boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS notes_internal text;

-- ============================================================
-- 7. CREATE media_creator_availability_rules
-- ============================================================
CREATE TABLE IF NOT EXISTS public.media_creator_availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.media_creators(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '17:00',
  is_available boolean DEFAULT true,
  booking_mode text DEFAULT 'both',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.media_creator_availability_rules ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_avail_rules_creator ON public.media_creator_availability_rules(creator_id);
CREATE INDEX idx_avail_rules_day ON public.media_creator_availability_rules(day_of_week);

CREATE POLICY "Creators manage own availability rules" ON public.media_creator_availability_rules
  FOR ALL USING (creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid()))
  WITH CHECK (creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid()));

CREATE POLICY "Public can view availability rules" ON public.media_creator_availability_rules
  FOR SELECT USING (true);

-- ============================================================
-- 8. CREATE media_creator_blackout_dates
-- ============================================================
CREATE TABLE IF NOT EXISTS public.media_creator_blackout_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.media_creators(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.media_creator_blackout_dates ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_blackout_creator ON public.media_creator_blackout_dates(creator_id);
CREATE INDEX idx_blackout_start ON public.media_creator_blackout_dates(start_date);
CREATE INDEX idx_blackout_end ON public.media_creator_blackout_dates(end_date);

CREATE POLICY "Creators manage own blackout dates" ON public.media_creator_blackout_dates
  FOR ALL USING (creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid()))
  WITH CHECK (creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid()));

-- ============================================================
-- 9. CREATE media_creator_addons
-- ============================================================
CREATE TABLE IF NOT EXISTS public.media_creator_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.media_creators(id) ON DELETE CASCADE,
  addon_code text NOT NULL,
  addon_name text NOT NULL,
  description text,
  price numeric DEFAULT 0,
  is_enabled boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.media_creator_addons ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_addons_creator ON public.media_creator_addons(creator_id);
CREATE INDEX idx_addons_enabled ON public.media_creator_addons(is_enabled);

CREATE POLICY "Creators manage own addons" ON public.media_creator_addons
  FOR ALL USING (creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid()))
  WITH CHECK (creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid()));

CREATE POLICY "Public can view enabled addons" ON public.media_creator_addons
  FOR SELECT USING (is_enabled = true);

-- ============================================================
-- 10. CREATE media_creator_gear
-- ============================================================
CREATE TABLE IF NOT EXISTS public.media_creator_gear (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.media_creators(id) ON DELETE CASCADE,
  gear_category text NOT NULL,
  gear_name text NOT NULL,
  notes text,
  is_public boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.media_creator_gear ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_gear_creator ON public.media_creator_gear(creator_id);
CREATE INDEX idx_gear_category ON public.media_creator_gear(gear_category);
CREATE INDEX idx_gear_public ON public.media_creator_gear(is_public);

CREATE POLICY "Creators manage own gear" ON public.media_creator_gear
  FOR ALL USING (creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid()))
  WITH CHECK (creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid()));

CREATE POLICY "Public can view public gear" ON public.media_creator_gear
  FOR SELECT USING (is_public = true);

-- ============================================================
-- 11. CREATE media_creator_notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.media_creator_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.media_creators(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  title text NOT NULL,
  body text,
  related_booking_id uuid REFERENCES public.media_bookings(id),
  related_offer_id uuid REFERENCES public.media_job_offers(id),
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.media_creator_notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notif_creator ON public.media_creator_notifications(creator_id);
CREATE INDEX idx_notif_read ON public.media_creator_notifications(is_read);
CREATE INDEX idx_notif_type ON public.media_creator_notifications(notification_type);
CREATE INDEX idx_notif_created ON public.media_creator_notifications(created_at DESC);

CREATE POLICY "Creators view own notifications" ON public.media_creator_notifications
  FOR SELECT USING (creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid()));

CREATE POLICY "Creators update own notifications" ON public.media_creator_notifications
  FOR UPDATE USING (creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid()));

-- ============================================================
-- 12. CREATE media_creator_performance_snapshots
-- ============================================================
CREATE TABLE IF NOT EXISTS public.media_creator_performance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.media_creators(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  profile_views int DEFAULT 0,
  booking_requests int DEFAULT 0,
  accepted_jobs int DEFAULT 0,
  completed_jobs int DEFAULT 0,
  cancelled_jobs int DEFAULT 0,
  conversion_rate numeric DEFAULT 0,
  avg_response_minutes numeric,
  avg_rating numeric,
  repeat_clients int DEFAULT 0,
  gross_earnings numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.media_creator_performance_snapshots ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_perf_creator ON public.media_creator_performance_snapshots(creator_id);
CREATE INDEX idx_perf_date ON public.media_creator_performance_snapshots(snapshot_date);

CREATE POLICY "Creators view own performance" ON public.media_creator_performance_snapshots
  FOR SELECT USING (creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid()));

-- ============================================================
-- 13. CREATE media_creator_payouts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.media_creator_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.media_creators(id) ON DELETE CASCADE,
  payout_period_start date NOT NULL,
  payout_period_end date NOT NULL,
  gross_amount numeric DEFAULT 0,
  fees_amount numeric DEFAULT 0,
  net_amount numeric DEFAULT 0,
  payout_status text DEFAULT 'pending',
  payout_sent_at timestamptz,
  payout_reference text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.media_creator_payouts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_payouts_creator ON public.media_creator_payouts(creator_id);
CREATE INDEX idx_payouts_status ON public.media_creator_payouts(payout_status);
CREATE INDEX idx_payouts_period ON public.media_creator_payouts(payout_period_start, payout_period_end);

CREATE POLICY "Creators view own payouts" ON public.media_creator_payouts
  FOR SELECT USING (creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid()));

-- ============================================================
-- 14. CREATE media_creator_profile_sections
-- ============================================================
CREATE TABLE IF NOT EXISTS public.media_creator_profile_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.media_creators(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  is_enabled boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(creator_id, section_key)
);
ALTER TABLE public.media_creator_profile_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators manage own profile sections" ON public.media_creator_profile_sections
  FOR ALL USING (creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid()))
  WITH CHECK (creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid()));

CREATE POLICY "Public can view profile sections" ON public.media_creator_profile_sections
  FOR SELECT USING (true);

-- ============================================================
-- 15. CREATE media_creator_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.media_creator_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL UNIQUE REFERENCES public.media_creators(id) ON DELETE CASCADE,
  sms_notifications_enabled boolean DEFAULT true,
  email_notifications_enabled boolean DEFAULT true,
  push_notifications_enabled boolean DEFAULT false,
  public_profile_visible boolean DEFAULT true,
  instant_booking_enabled boolean DEFAULT false,
  scheduled_booking_enabled boolean DEFAULT true,
  travel_enabled boolean DEFAULT false,
  auto_accept_disabled boolean DEFAULT false,
  preferred_booking_notice_hours int DEFAULT 24,
  default_service_radius_miles int DEFAULT 25,
  timezone text DEFAULT 'America/New_York',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.media_creator_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators manage own settings" ON public.media_creator_settings
  FOR ALL USING (creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid()))
  WITH CHECK (creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid()));

-- ============================================================
-- 16. RPC: creator_public_profile_view
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_creator_public_profile(p_slug text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id uuid;
  v_result json;
BEGIN
  SELECT id INTO v_creator_id FROM media_creators
    WHERE slug = p_slug AND profile_visibility_status = 'published';
  IF v_creator_id IS NULL THEN RETURN NULL; END IF;

  SELECT json_build_object(
    'profile', (
      SELECT row_to_json(c) FROM (
        SELECT id, slug, display_name, provider_type, bio, short_tagline, signature_style,
               city, state, country, service_area, service_radius_miles, years_experience,
               is_verified, is_available, accepts_instant_bookings, accepts_scheduled_bookings,
               hourly_rate, half_day_rate, full_day_rate, custom_quote_enabled,
               minimum_booking_hours, response_time_hours,
               same_day_edit_available, drone_available, editing_available,
               on_site_editing_available, multi_camera_available, assistant_team_available,
               rating, total_jobs_completed, acceptance_rate, repeat_client_rate,
               average_delivery_hours, profile_image_url, cover_image_url,
               instagram_handle, website_url, languages_spoken, specialties,
               equipment_list, public_badges
        FROM media_creators WHERE id = v_creator_id
      ) c
    ),
    'projects', (
      SELECT coalesce(json_agg(p ORDER BY p.sort_order), '[]'::json) FROM (
        SELECT id, title, description, category, event_type, city, media_type,
               media_url, thumbnail_url, is_featured, is_case_study, tags
        FROM media_creator_projects WHERE creator_id = v_creator_id AND is_public = true
      ) p
    ),
    'reviews', (
      SELECT coalesce(json_agg(r ORDER BY r.created_at DESC), '[]'::json) FROM (
        SELECT id, rating, review_text, event_type, creator_response, created_at
        FROM media_creator_reviews WHERE creator_id = v_creator_id AND is_public = true
      ) r
    ),
    'gear', (
      SELECT coalesce(json_agg(g ORDER BY g.sort_order), '[]'::json) FROM (
        SELECT id, gear_category, gear_name FROM media_creator_gear
        WHERE creator_id = v_creator_id AND is_public = true
      ) g
    ),
    'addons', (
      SELECT coalesce(json_agg(a ORDER BY a.sort_order), '[]'::json) FROM (
        SELECT id, addon_code, addon_name, description, price FROM media_creator_addons
        WHERE creator_id = v_creator_id AND is_enabled = true
      ) a
    ),
    'sections', (
      SELECT coalesce(json_agg(s ORDER BY s.sort_order), '[]'::json) FROM (
        SELECT section_key, is_enabled, sort_order FROM media_creator_profile_sections
        WHERE creator_id = v_creator_id
      ) s
    ),
    'availability', (
      SELECT coalesce(json_agg(av ORDER BY av.day_of_week), '[]'::json) FROM (
        SELECT day_of_week, start_time, end_time, is_available, booking_mode
        FROM media_creator_availability_rules
        WHERE creator_id = v_creator_id AND is_available = true
      ) av
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 17. RPC: creator_dashboard_summary
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_creator_dashboard_summary()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id uuid;
  v_result json;
BEGIN
  SELECT id INTO v_creator_id FROM media_creators WHERE user_id = auth.uid() LIMIT 1;
  IF v_creator_id IS NULL THEN RETURN NULL; END IF;

  SELECT json_build_object(
    'earnings_today', coalesce((
      SELECT sum(creator_payout_amount) FROM media_bookings
      WHERE creator_id = v_creator_id AND booking_status = 'completed'
        AND created_at::date = current_date
    ), 0),
    'earnings_this_week', coalesce((
      SELECT sum(creator_payout_amount) FROM media_bookings
      WHERE creator_id = v_creator_id AND booking_status = 'completed'
        AND created_at >= date_trunc('week', current_date)
    ), 0),
    'upcoming_bookings', (
      SELECT count(*) FROM media_bookings
      WHERE creator_id = v_creator_id AND booking_status IN ('assigned','confirmed')
    ),
    'pending_offers', (
      SELECT count(*) FROM media_job_offers
      WHERE creator_id = v_creator_id AND status = 'pending'
    ),
    'avg_rating', coalesce((SELECT rating FROM media_creators WHERE id = v_creator_id), 0),
    'acceptance_rate', coalesce((SELECT acceptance_rate FROM media_creators WHERE id = v_creator_id), 0),
    'response_time_hours', coalesce((SELECT response_time_hours FROM media_creators WHERE id = v_creator_id), 0),
    'total_jobs', coalesce((SELECT total_jobs_completed FROM media_creators WHERE id = v_creator_id), 0),
    'unread_notifications', (
      SELECT count(*) FROM media_creator_notifications
      WHERE creator_id = v_creator_id AND is_read = false
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 18. RPC: creator_profile_completion
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_creator_profile_completion()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id uuid;
  v_total int := 0;
  v_filled int := 0;
  v_items json;
BEGIN
  SELECT id INTO v_creator_id FROM media_creators WHERE user_id = auth.uid() LIMIT 1;
  IF v_creator_id IS NULL THEN RETURN json_build_object('percentage', 0, 'items', '[]'::json); END IF;

  v_total := 10;

  -- 1 profile photo
  IF (SELECT profile_image_url FROM media_creators WHERE id = v_creator_id) IS NOT NULL THEN v_filled := v_filled + 1; END IF;
  -- 2 bio
  IF (SELECT bio FROM media_creators WHERE id = v_creator_id) IS NOT NULL THEN v_filled := v_filled + 1; END IF;
  -- 3 specialties
  IF (SELECT array_length(specialties, 1) FROM media_creators WHERE id = v_creator_id) > 0 THEN v_filled := v_filled + 1; END IF;
  -- 4 hourly rate
  IF (SELECT hourly_rate FROM media_creators WHERE id = v_creator_id) > 0 THEN v_filled := v_filled + 1; END IF;
  -- 5 portfolio
  IF (SELECT count(*) FROM media_creator_projects WHERE creator_id = v_creator_id) > 0 THEN v_filled := v_filled + 1; END IF;
  -- 6 gear
  IF (SELECT count(*) FROM media_creator_gear WHERE creator_id = v_creator_id) > 0 THEN v_filled := v_filled + 1; END IF;
  -- 7 verification submitted
  IF (SELECT count(*) FROM media_creator_verification WHERE creator_id = v_creator_id) > 0 THEN v_filled := v_filled + 1; END IF;
  -- 8 availability
  IF (SELECT count(*) FROM media_creator_availability_rules WHERE creator_id = v_creator_id) > 0 THEN v_filled := v_filled + 1; END IF;
  -- 9 display name
  IF (SELECT display_name FROM media_creators WHERE id = v_creator_id) IS NOT NULL THEN v_filled := v_filled + 1; END IF;
  -- 10 city
  IF (SELECT city FROM media_creators WHERE id = v_creator_id) IS NOT NULL THEN v_filled := v_filled + 1; END IF;

  RETURN json_build_object(
    'percentage', round((v_filled::numeric / v_total::numeric) * 100),
    'total', v_total,
    'filled', v_filled
  );
END;
$$;

-- ============================================================
-- 19. ADMIN RLS policies for new tables
-- ============================================================
-- Helper: check if user is admin via user_roles
CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = 'admin'
  );
$$;

-- Admin policies for all new tables
CREATE POLICY "Admins full access availability_rules" ON public.media_creator_availability_rules
  FOR ALL USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins full access blackout_dates" ON public.media_creator_blackout_dates
  FOR ALL USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins full access addons" ON public.media_creator_addons
  FOR ALL USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins full access gear" ON public.media_creator_gear
  FOR ALL USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins full access notifications" ON public.media_creator_notifications
  FOR ALL USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins full access performance" ON public.media_creator_performance_snapshots
  FOR ALL USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins full access payouts" ON public.media_creator_payouts
  FOR ALL USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins full access profile_sections" ON public.media_creator_profile_sections
  FOR ALL USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins full access settings" ON public.media_creator_settings
  FOR ALL USING (public.is_admin_user(auth.uid()));
