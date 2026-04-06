
-- Platform-controlled service categories with pricing floors
CREATE TABLE public.beauty_service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  starting_from_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  minimum_price_threshold NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.beauty_service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active categories"
  ON public.beauty_service_categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage categories"
  ON public.beauty_service_categories FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Provider custom quotes per booking
CREATE TABLE public.beauty_provider_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.beauty_bookings(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.beauty_providers(id) ON DELETE CASCADE,
  quoted_price NUMERIC(10,2) NOT NULL,
  add_ons_json JSONB DEFAULT '[]'::jsonb,
  quote_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','expired')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.beauty_provider_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view quotes on their bookings"
  ON public.beauty_provider_quotes FOR SELECT
  TO authenticated
  USING (
    provider_id IN (SELECT id FROM public.beauty_providers WHERE user_id = auth.uid())
    OR booking_id IN (SELECT id FROM public.beauty_bookings WHERE user_id = auth.uid())
  );

CREATE POLICY "Providers can create quotes"
  ON public.beauty_provider_quotes FOR INSERT
  TO authenticated
  WITH CHECK (
    provider_id IN (SELECT id FROM public.beauty_providers WHERE user_id = auth.uid())
  );

CREATE POLICY "Providers can update own quotes"
  ON public.beauty_provider_quotes FOR UPDATE
  TO authenticated
  USING (
    provider_id IN (SELECT id FROM public.beauty_providers WHERE user_id = auth.uid())
  );

-- Provider listing upgrades (featured/priority)
CREATE TABLE public.beauty_provider_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.beauty_providers(id) ON DELETE CASCADE UNIQUE,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_priority BOOLEAN NOT NULL DEFAULT false,
  priority_expires_at TIMESTAMPTZ,
  listing_fee_paid NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.beauty_provider_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active listings"
  ON public.beauty_provider_listings FOR SELECT
  USING (true);

CREATE POLICY "Providers can manage own listing"
  ON public.beauty_provider_listings FOR ALL
  TO authenticated
  USING (provider_id IN (SELECT id FROM public.beauty_providers WHERE user_id = auth.uid()))
  WITH CHECK (provider_id IN (SELECT id FROM public.beauty_providers WHERE user_id = auth.uid()));

-- Enhance provider_services with platform pricing controls
ALTER TABLE public.provider_services
  ADD COLUMN IF NOT EXISTS platform_starting_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS allows_custom_quotes BOOLEAN NOT NULL DEFAULT true;

-- Triggers for updated_at
CREATE TRIGGER update_beauty_service_categories_updated_at
  BEFORE UPDATE ON public.beauty_service_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_beauty_provider_quotes_updated_at
  BEFORE UPDATE ON public.beauty_provider_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_beauty_provider_listings_updated_at
  BEFORE UPDATE ON public.beauty_provider_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_beauty_provider_quotes_booking ON public.beauty_provider_quotes(booking_id);
CREATE INDEX idx_beauty_provider_quotes_provider ON public.beauty_provider_quotes(provider_id);
CREATE INDEX idx_beauty_provider_listings_featured ON public.beauty_provider_listings(is_featured) WHERE is_featured = true;
