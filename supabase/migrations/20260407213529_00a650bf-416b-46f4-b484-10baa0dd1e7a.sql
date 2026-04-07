
-- ============================================
-- 1. RENTAL PARTNERS
-- ============================================
CREATE TABLE IF NOT EXISTS public.rental_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  business_name text NOT NULL,
  owner_name text NOT NULL,
  phone text,
  email text,
  city text,
  state text,
  geo_lat numeric,
  geo_lng numeric,
  verified boolean DEFAULT false,
  rating numeric DEFAULT 0,
  total_bookings integer DEFAULT 0,
  commission_rate numeric DEFAULT 0.25,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.rental_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view verified partners"
  ON public.rental_partners FOR SELECT USING (true);

CREATE POLICY "Partners can update own profile"
  ON public.rental_partners FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can apply as partner"
  ON public.rental_partners FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins full access partners"
  ON public.rental_partners FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- 2. RENTAL VEHICLES
-- ============================================
CREATE TABLE IF NOT EXISTS public.rental_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.rental_partners(id) ON DELETE CASCADE,
  vehicle_type text NOT NULL CHECK (vehicle_type IN ('slingshot', 'spyder')),
  brand text NOT NULL,
  model text,
  year integer,
  color text,
  images text[] DEFAULT '{}',
  hourly_price numeric DEFAULT 0,
  daily_price numeric DEFAULT 0,
  availability_status text DEFAULT 'available' CHECK (availability_status IN ('available', 'booked', 'maintenance', 'inactive')),
  instant_book boolean DEFAULT false,
  approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.rental_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view approved vehicles"
  ON public.rental_vehicles FOR SELECT USING (true);

CREATE POLICY "Partners can manage own vehicles"
  ON public.rental_vehicles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.rental_partners rp
      WHERE rp.id = rental_vehicles.partner_id AND rp.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins full access vehicles"
  ON public.rental_vehicles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- 3. RENTAL ADDONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.rental_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  category text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.rental_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active addons"
  ON public.rental_addons FOR SELECT USING (true);

CREATE POLICY "Admins manage addons"
  ON public.rental_addons FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- 4. RENTAL BOOKINGS
-- ============================================
CREATE TABLE IF NOT EXISTS public.rental_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES public.rental_vehicles(id),
  partner_id uuid NOT NULL REFERENCES public.rental_partners(id),
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  duration_type text DEFAULT 'day' CHECK (duration_type IN ('hour', 'day')),
  base_price numeric DEFAULT 0,
  total_price numeric DEFAULT 0,
  commission_rate numeric DEFAULT 0.25,
  commission_amount numeric DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.rental_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookings"
  ON public.rental_bookings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create bookings"
  ON public.rental_bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Partners can view their bookings"
  ON public.rental_bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rental_partners rp
      WHERE rp.id = rental_bookings.partner_id AND rp.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins full access bookings"
  ON public.rental_bookings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- 5. RENTAL BOOKING ADDONS (junction)
-- ============================================
CREATE TABLE IF NOT EXISTS public.rental_booking_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.rental_bookings(id) ON DELETE CASCADE,
  addon_id uuid NOT NULL REFERENCES public.rental_addons(id),
  quantity integer DEFAULT 1,
  price_at_booking numeric DEFAULT 0
);

ALTER TABLE public.rental_booking_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own booking addons"
  ON public.rental_booking_addons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rental_bookings rb
      WHERE rb.id = rental_booking_addons.booking_id AND rb.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add addons to own bookings"
  ON public.rental_booking_addons FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rental_bookings rb
      WHERE rb.id = rental_booking_addons.booking_id AND rb.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins full access booking addons"
  ON public.rental_booking_addons FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- 6. PARTNER PAYOUTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.partner_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.rental_partners(id),
  booking_id uuid REFERENCES public.rental_bookings(id),
  total_amount numeric DEFAULT 0,
  commission_taken numeric DEFAULT 0,
  payout_amount numeric DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.partner_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view own payouts"
  ON public.partner_payouts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rental_partners rp
      WHERE rp.id = partner_payouts.partner_id AND rp.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins full access payouts"
  ON public.partner_payouts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- 7. GEO SEARCH FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.search_rental_vehicles_by_location(
  p_lat numeric,
  p_lng numeric,
  p_radius_miles numeric DEFAULT 50,
  p_vehicle_type text DEFAULT NULL
)
RETURNS TABLE (
  vehicle_id uuid,
  partner_id uuid,
  business_name text,
  vehicle_type text,
  brand text,
  model text,
  year integer,
  color text,
  images text[],
  hourly_price numeric,
  daily_price numeric,
  instant_book boolean,
  partner_rating numeric,
  partner_verified boolean,
  distance_miles numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    v.id AS vehicle_id,
    p.id AS partner_id,
    p.business_name,
    v.vehicle_type,
    v.brand,
    v.model,
    v.year,
    v.color,
    v.images,
    v.hourly_price,
    v.daily_price,
    v.instant_book,
    p.rating AS partner_rating,
    p.verified AS partner_verified,
    round((3959 * acos(
      cos(radians(p_lat)) * cos(radians(p.geo_lat)) *
      cos(radians(p.geo_lng) - radians(p_lng)) +
      sin(radians(p_lat)) * sin(radians(p.geo_lat))
    ))::numeric, 1) AS distance_miles
  FROM rental_vehicles v
  JOIN rental_partners p ON p.id = v.partner_id
  WHERE v.availability_status = 'available'
    AND v.approved = true
    AND p.verified = true
    AND p.status = 'approved'
    AND (p_vehicle_type IS NULL OR v.vehicle_type = p_vehicle_type)
    AND (3959 * acos(
      cos(radians(p_lat)) * cos(radians(p.geo_lat)) *
      cos(radians(p.geo_lng) - radians(p_lng)) +
      sin(radians(p_lat)) * sin(radians(p.geo_lat))
    )) <= p_radius_miles
  ORDER BY distance_miles ASC, p.rating DESC;
$$;

-- ============================================
-- 8. COMMISSION AUTO-CALC TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.trg_rental_booking_commission()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_rate numeric;
BEGIN
  SELECT COALESCE(rp.commission_rate, 0.25)
    INTO v_rate
    FROM rental_partners rp
    WHERE rp.id = NEW.partner_id;

  NEW.commission_rate := v_rate;
  NEW.commission_amount := round(NEW.total_price * v_rate, 2);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rental_booking_calc_commission
  BEFORE INSERT OR UPDATE OF total_price ON public.rental_bookings
  FOR EACH ROW EXECUTE FUNCTION public.trg_rental_booking_commission();

-- ============================================
-- 9. DOUBLE-BOOKING PREVENTION
-- ============================================
CREATE OR REPLACE FUNCTION public.trg_prevent_double_booking()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM rental_bookings
    WHERE vehicle_id = NEW.vehicle_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND status IN ('pending', 'confirmed')
      AND NEW.start_date < end_date
      AND NEW.end_date > start_date
  ) THEN
    RAISE EXCEPTION 'Vehicle is already booked for this time period';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_double_booking
  BEFORE INSERT OR UPDATE ON public.rental_bookings
  FOR EACH ROW EXECUTE FUNCTION public.trg_prevent_double_booking();

-- ============================================
-- 10. AUTO PAYOUT RECORD ON COMPLETED BOOKING
-- ============================================
CREATE OR REPLACE FUNCTION public.trg_create_partner_payout()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    INSERT INTO partner_payouts (partner_id, booking_id, total_amount, commission_taken, payout_amount)
    VALUES (
      NEW.partner_id,
      NEW.id,
      NEW.total_price,
      NEW.commission_amount,
      NEW.total_price - NEW.commission_amount
    );

    UPDATE rental_partners
      SET total_bookings = total_bookings + 1
      WHERE id = NEW.partner_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_create_payout
  AFTER UPDATE ON public.rental_bookings
  FOR EACH ROW EXECUTE FUNCTION public.trg_create_partner_payout();

-- ============================================
-- 11. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_rental_partners_geo ON public.rental_partners (geo_lat, geo_lng);
CREATE INDEX IF NOT EXISTS idx_rental_partners_state ON public.rental_partners (state);
CREATE INDEX IF NOT EXISTS idx_rental_vehicles_partner ON public.rental_vehicles (partner_id);
CREATE INDEX IF NOT EXISTS idx_rental_vehicles_type ON public.rental_vehicles (vehicle_type);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_vehicle ON public.rental_bookings (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_partner ON public.rental_bookings (partner_id);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_user ON public.rental_bookings (user_id);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_dates ON public.rental_bookings (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_partner ON public.partner_payouts (partner_id);

-- ============================================
-- 12. REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.rental_bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_payouts;
