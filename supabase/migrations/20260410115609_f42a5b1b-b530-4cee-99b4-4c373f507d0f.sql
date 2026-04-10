
-- ut_profiles
CREATE TABLE public.ut_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  city text,
  state text,
  user_type text DEFAULT 'customer' CHECK (user_type IN ('customer','vendor','ambassador','admin')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ut_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ut_profiles_select_own" ON public.ut_profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "ut_profiles_update_own" ON public.ut_profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "ut_profiles_insert_own" ON public.ut_profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- ut_vendors
CREATE TABLE public.ut_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_name text NOT NULL,
  vendor_type text NOT NULL CHECK (vendor_type IN ('venue','staff','rental','catering','entertainment')),
  city text, state text, lat numeric, lng numeric,
  price_per_hour numeric, price_per_day numeric, price_flat_rate numeric,
  cover_photo text, photos text[], description text, tagline text,
  capacity_min int, capacity_max int, amenities text[],
  status text DEFAULT 'pending' CHECK (status IN ('active','pending','suspended')),
  featured bool DEFAULT false, stripe_connect_id text,
  verified bool DEFAULT false, rating numeric DEFAULT 0,
  review_count int DEFAULT 0, bookings_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ut_vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendors_public_read" ON public.ut_vendors FOR SELECT USING (status = 'active');
CREATE POLICY "vendors_owner_read" ON public.ut_vendors FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "vendors_insert" ON public.ut_vendors FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "vendors_update" ON public.ut_vendors FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "vendors_delete" ON public.ut_vendors FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- ut_pub_events (separate from existing ut_events)
CREATE TABLE public.ut_pub_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_type text, event_date date, city text, state text,
  guest_count int, budget numeric, status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ut_pub_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pub_events_owner" ON public.ut_pub_events FOR ALL TO authenticated USING (customer_id = auth.uid());

-- ut_event_builds
CREATE TABLE public.ut_event_builds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text, city text, event_date date, guest_count int,
  budget numeric, selected_items jsonb DEFAULT '[]',
  status text DEFAULT 'draft', created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ut_event_builds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "builds_anon_insert" ON public.ut_event_builds FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "builds_auth_insert" ON public.ut_event_builds FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "builds_owner_select" ON public.ut_event_builds FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "builds_owner_update" ON public.ut_event_builds FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "builds_session_select" ON public.ut_event_builds FOR SELECT TO anon USING (session_id IS NOT NULL);

-- ut_bookings
CREATE TABLE public.ut_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vendor_id uuid REFERENCES public.ut_vendors(id) ON DELETE CASCADE NOT NULL,
  event_id uuid REFERENCES public.ut_pub_events(id) ON DELETE SET NULL,
  event_date date, guest_count int,
  status text DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','completed')),
  total_amount numeric, platform_fee numeric, vendor_payout numeric,
  stripe_payment_intent_id text, stripe_transfer_id text,
  cancellation_reason text, refund_amount numeric,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ut_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookings_customer" ON public.ut_bookings FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "bookings_vendor" ON public.ut_bookings FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.ut_vendors v WHERE v.id = vendor_id AND v.owner_id = auth.uid())
);
CREATE POLICY "bookings_insert" ON public.ut_bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "bookings_update_vendor" ON public.ut_bookings FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.ut_vendors v WHERE v.id = vendor_id AND v.owner_id = auth.uid())
);
CREATE POLICY "bookings_update_customer" ON public.ut_bookings FOR UPDATE TO authenticated USING (customer_id = auth.uid());

-- ut_quote_requests
CREATE TABLE public.ut_quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES public.ut_vendors(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  customer_name text, customer_email text, customer_phone text,
  event_type text, event_date date, guest_count int, budget numeric,
  message text,
  status text DEFAULT 'new' CHECK (status IN ('new','viewed','responded','booked')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ut_quote_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quotes_vendor" ON public.ut_quote_requests FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.ut_vendors v WHERE v.id = vendor_id AND v.owner_id = auth.uid())
);
CREATE POLICY "quotes_customer" ON public.ut_quote_requests FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "quotes_insert" ON public.ut_quote_requests FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "quotes_update_vendor" ON public.ut_quote_requests FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.ut_vendors v WHERE v.id = vendor_id AND v.owner_id = auth.uid())
);

-- ut_reviews
CREATE TABLE public.ut_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES public.ut_vendors(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  booking_id uuid REFERENCES public.ut_bookings(id) ON DELETE SET NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text, response text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ut_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_public_read" ON public.ut_reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert" ON public.ut_reviews FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "reviews_update_author" ON public.ut_reviews FOR UPDATE TO authenticated USING (customer_id = auth.uid());

-- ut_pub_messages
CREATE TABLE public.ut_pub_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.ut_bookings(id) ON DELETE SET NULL,
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  body text NOT NULL, read bool DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ut_pub_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msgs_sender" ON public.ut_pub_messages FOR SELECT TO authenticated USING (sender_id = auth.uid());
CREATE POLICY "msgs_recipient" ON public.ut_pub_messages FOR SELECT TO authenticated USING (recipient_id = auth.uid());
CREATE POLICY "msgs_insert" ON public.ut_pub_messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
CREATE POLICY "msgs_mark_read" ON public.ut_pub_messages FOR UPDATE TO authenticated USING (recipient_id = auth.uid());

-- ut_pub_referrals
CREATE TABLE public.ut_pub_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ref_code text, order_id text,
  booking_id uuid REFERENCES public.ut_bookings(id) ON DELETE SET NULL,
  commission_rate numeric, commission_amount numeric,
  status text DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ut_pub_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals_ambassador" ON public.ut_pub_referrals FOR SELECT TO authenticated USING (ambassador_id = auth.uid());

-- ut_ambassadors (new public ambassador table)
CREATE TABLE public.ut_pub_ambassadors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ref_code text UNIQUE NOT NULL,
  tier text DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','platinum')),
  total_sales int DEFAULT 0, total_earned numeric DEFAULT 0,
  payout_email text, stripe_connect_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ut_pub_ambassadors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "amb_self" ON public.ut_pub_ambassadors FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "amb_insert" ON public.ut_pub_ambassadors FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "amb_update" ON public.ut_pub_ambassadors FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ut_promotions
CREATE TABLE public.ut_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, discount_percent int,
  promo_code text UNIQUE, start_at timestamptz, end_at timestamptz,
  is_active bool DEFAULT true, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ut_promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promos_public_read" ON public.ut_promotions FOR SELECT USING (is_active = true);

-- ut_user_favorites
CREATE TABLE public.ut_user_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vendor_id uuid REFERENCES public.ut_vendors(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, vendor_id)
);
ALTER TABLE public.ut_user_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favs_self_select" ON public.ut_user_favorites FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "favs_self_insert" ON public.ut_user_favorites FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "favs_self_delete" ON public.ut_user_favorites FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ut_vendor_blocked_dates
CREATE TABLE public.ut_vendor_blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES public.ut_vendors(id) ON DELETE CASCADE NOT NULL,
  blocked_date date NOT NULL, reason text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ut_vendor_blocked_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocked_public_read" ON public.ut_vendor_blocked_dates FOR SELECT USING (true);
CREATE POLICY "blocked_vendor_write" ON public.ut_vendor_blocked_dates FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.ut_vendors v WHERE v.id = vendor_id AND v.owner_id = auth.uid())
);
CREATE POLICY "blocked_vendor_delete" ON public.ut_vendor_blocked_dates FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.ut_vendors v WHERE v.id = vendor_id AND v.owner_id = auth.uid())
);

-- ut_virtual_tour_requests_pub
CREATE TABLE public.ut_virtual_tour_requests_pub (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES public.ut_vendors(id) ON DELETE CASCADE NOT NULL,
  requester_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pending', created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ut_virtual_tour_requests_pub ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vtr_requester" ON public.ut_virtual_tour_requests_pub FOR ALL TO authenticated USING (requester_id = auth.uid());
CREATE POLICY "vtr_vendor" ON public.ut_virtual_tour_requests_pub FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.ut_vendors v WHERE v.id = vendor_id AND v.owner_id = auth.uid())
);

-- dynasty_os_api_logs
CREATE TABLE public.dynasty_os_api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL, method text DEFAULT 'GET',
  caller_ip text, response_status int,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.dynasty_os_api_logs ENABLE ROW LEVEL SECURITY;

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('vendor-covers', 'vendor-covers', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('vendor-photos', 'vendor-photos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('vendor-documents', 'vendor-documents', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-photos', 'profile-photos', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "vc_pub_read" ON storage.objects FOR SELECT USING (bucket_id = 'vendor-covers');
CREATE POLICY "vc_auth_write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'vendor-covers');
CREATE POLICY "vp_pub_read" ON storage.objects FOR SELECT USING (bucket_id = 'vendor-photos');
CREATE POLICY "vp_auth_write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'vendor-photos');
CREATE POLICY "vd_owner_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'vendor-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "vd_owner_write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'vendor-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "inv_cust_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "pp_pub_read" ON storage.objects FOR SELECT USING (bucket_id = 'profile-photos');
CREATE POLICY "pp_self_write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Trigger: auto-create ut_profile on signup
CREATE OR REPLACE FUNCTION public.handle_ut_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.ut_profiles (id, email, full_name, user_type)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name',''), COALESCE(NEW.raw_user_meta_data->>'user_type','customer'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_ut_user_created ON auth.users;
CREATE TRIGGER on_ut_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_ut_new_user();

-- Trigger: auto-update vendor rating on review
CREATE OR REPLACE FUNCTION public.ut_update_vendor_rating()
RETURNS trigger AS $$
BEGIN
  UPDATE public.ut_vendors
  SET rating = (SELECT COALESCE(AVG(rating),0) FROM public.ut_reviews WHERE vendor_id = NEW.vendor_id),
      review_count = (SELECT COUNT(*) FROM public.ut_reviews WHERE vendor_id = NEW.vendor_id)
  WHERE id = NEW.vendor_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER ut_review_rating_update AFTER INSERT OR UPDATE ON public.ut_reviews FOR EACH ROW EXECUTE FUNCTION public.ut_update_vendor_rating();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ut_pub_messages;

-- Indexes
CREATE INDEX idx_ut_vendors_type ON public.ut_vendors(vendor_type, status);
CREATE INDEX idx_ut_vendors_geo ON public.ut_vendors(city, state);
CREATE INDEX idx_ut_bookings_cust ON public.ut_bookings(customer_id);
CREATE INDEX idx_ut_bookings_vend ON public.ut_bookings(vendor_id);
CREATE INDEX idx_ut_reviews_vend ON public.ut_reviews(vendor_id);
CREATE INDEX idx_ut_quotes_vend ON public.ut_quote_requests(vendor_id);
CREATE INDEX idx_ut_msgs_sender ON public.ut_pub_messages(sender_id);
CREATE INDEX idx_ut_msgs_recip ON public.ut_pub_messages(recipient_id);
