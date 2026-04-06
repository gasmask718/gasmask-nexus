
-- Provider service menu
CREATE TABLE IF NOT EXISTS public.provider_service_menu (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES public.beauty_providers(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  category TEXT,
  base_price NUMERIC(10,2) NOT NULL,
  price_type TEXT NOT NULL DEFAULT 'flat' CHECK (price_type IN ('per_person','per_hour','flat')),
  duration INTEGER,
  is_addon BOOLEAN NOT NULL DEFAULT false,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_service_menu ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view service menu" ON public.provider_service_menu FOR SELECT USING (true);
CREATE POLICY "Providers manage own menu" ON public.provider_service_menu FOR ALL
  USING (EXISTS (SELECT 1 FROM public.beauty_providers bp WHERE bp.id = provider_id AND bp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.beauty_providers bp WHERE bp.id = provider_id AND bp.user_id = auth.uid()));

CREATE INDEX idx_service_menu_provider ON public.provider_service_menu(provider_id, display_order);

-- Provider packages
CREATE TABLE IF NOT EXISTS public.provider_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES public.beauty_providers(id) ON DELETE CASCADE,
  package_name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  included_services UUID[] DEFAULT '{}',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view packages" ON public.provider_packages FOR SELECT USING (true);
CREATE POLICY "Providers manage own packages" ON public.provider_packages FOR ALL
  USING (EXISTS (SELECT 1 FROM public.beauty_providers bp WHERE bp.id = provider_id AND bp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.beauty_providers bp WHERE bp.id = provider_id AND bp.user_id = auth.uid()));

CREATE INDEX idx_packages_provider ON public.provider_packages(provider_id);

-- Booking service selections
CREATE TABLE IF NOT EXISTS public.booking_service_selections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.beauty_bookings(id) ON DELETE CASCADE,
  service_menu_id UUID REFERENCES public.provider_service_menu(id),
  package_id UUID REFERENCES public.provider_packages(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_service_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own booking selections" ON public.booking_service_selections FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.beauty_bookings bb WHERE bb.id = booking_id AND bb.user_id = auth.uid()));
CREATE POLICY "Users create own booking selections" ON public.booking_service_selections FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.beauty_bookings bb WHERE bb.id = booking_id AND bb.user_id = auth.uid()));
CREATE POLICY "Providers view booking selections" ON public.booking_service_selections FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.beauty_bookings bb JOIN public.beauty_providers bp ON bp.id = bb.provider_id WHERE bb.id = booking_id AND bp.user_id = auth.uid()));

CREATE INDEX idx_booking_selections_booking ON public.booking_service_selections(booking_id);
