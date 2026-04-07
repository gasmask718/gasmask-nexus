
-- ============================================
-- 1. CROSS-SELL RECOMMENDATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.cross_sell_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_category text NOT NULL,
  recommended_category text NOT NULL,
  title text NOT NULL,
  description text,
  icon text,
  discount_percentage numeric DEFAULT 0,
  priority_score integer DEFAULT 0,
  city_filter text,
  same_city_boost boolean DEFAULT true,
  same_date_boost boolean DEFAULT true,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.cross_sell_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active recommendations"
  ON public.cross_sell_recommendations FOR SELECT
  USING (active = true);

CREATE POLICY "Admins manage recommendations"
  ON public.cross_sell_recommendations FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- 2. CROSS-SELL IMPRESSIONS (analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS public.cross_sell_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid REFERENCES public.cross_sell_recommendations(id) ON DELETE CASCADE,
  user_id uuid,
  source_booking_id uuid,
  source_category text,
  action text DEFAULT 'shown' CHECK (action IN ('shown', 'clicked', 'booked')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cross_sell_impressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own impressions"
  ON public.cross_sell_impressions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all impressions"
  ON public.cross_sell_impressions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- 3. CROSS-SELL BUNDLES
-- ============================================
CREATE TABLE IF NOT EXISTS public.cross_sell_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_name text NOT NULL,
  categories text[] NOT NULL,
  bundle_discount numeric DEFAULT 0,
  city text,
  partner_id uuid,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cross_sell_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active bundles"
  ON public.cross_sell_bundles FOR SELECT
  USING (active = true);

CREATE POLICY "Admins manage bundles"
  ON public.cross_sell_bundles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- 4. FETCH RECOMMENDATIONS RPC
-- ============================================
CREATE OR REPLACE FUNCTION public.get_cross_sell_recommendations(
  p_trigger_category text,
  p_city text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  recommended_category text,
  title text,
  description text,
  icon text,
  discount_percentage numeric,
  priority_score integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    r.id,
    r.recommended_category,
    r.title,
    r.description,
    r.icon,
    r.discount_percentage,
    r.priority_score +
      CASE WHEN r.same_city_boost AND r.city_filter IS NOT NULL AND r.city_filter = p_city THEN 10 ELSE 0 END
      AS priority_score
  FROM cross_sell_recommendations r
  WHERE r.trigger_category = p_trigger_category
    AND r.active = true
    AND (r.city_filter IS NULL OR r.city_filter = p_city)
  ORDER BY priority_score DESC;
$$;

-- ============================================
-- 5. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_cross_sell_trigger ON public.cross_sell_recommendations (trigger_category, active);
CREATE INDEX IF NOT EXISTS idx_cross_sell_impressions_rec ON public.cross_sell_impressions (recommendation_id);
CREATE INDEX IF NOT EXISTS idx_cross_sell_bundles_cats ON public.cross_sell_bundles USING GIN (categories);

-- ============================================
-- 6. SEED DEFAULT RECOMMENDATIONS
-- ============================================
INSERT INTO public.cross_sell_recommendations (trigger_category, recommended_category, title, description, icon, discount_percentage, priority_score) VALUES
  ('motors', 'exotic_cars', 'Upgrade to Exotic Car', 'Turn heads with a Lamborghini or Ferrari experience', '🚗', 10, 5),
  ('motors', 'water', 'Add Jet Ski Experience', 'Hit the waves after the road', '🌊', 15, 4),
  ('motors', 'nightlife', 'Add Night Package', 'VIP nightlife after your ride', '🌃', 10, 3),
  ('exotic_cars', 'motors', 'Add Slingshot Ride', 'Feel the open road in a Polaris Slingshot', '🏎️', 10, 4),
  ('exotic_cars', 'water', 'Add Yacht Charter', 'Luxury on land and sea', '🛥️', 5, 5),
  ('exotic_cars', 'nightlife', 'Add VIP Nightlife', 'Complete the luxury day', '🌃', 10, 3),
  ('water', 'motors', 'Add Slingshot Cruise', 'Road trip after the waves', '🏎️', 10, 4),
  ('water', 'exotic_cars', 'Add Exotic Car', 'Arrive in style', '🚗', 10, 5),
  ('water', 'nightlife', 'Add Sunset Party', 'End the day with nightlife', '🌃', 15, 3);
