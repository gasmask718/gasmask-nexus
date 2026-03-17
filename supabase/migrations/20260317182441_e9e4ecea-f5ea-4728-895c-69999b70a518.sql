
-- Testimonials for trust layer
CREATE TABLE IF NOT EXISTS public.brandaro_testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  testimonial_text TEXT NOT NULL,
  rating INTEGER DEFAULT 5,
  industry TEXT,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read testimonials" ON public.brandaro_testimonials FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Auth insert testimonials" ON public.brandaro_testimonials FOR INSERT TO authenticated WITH CHECK (true);

-- Seed testimonials
INSERT INTO public.brandaro_testimonials (business_name, testimonial_text, rating, industry, is_featured) VALUES
('Mike''s Auto Shop', 'We went from zero online presence to getting 15+ calls a week. Best investment we made.', 5, 'automotive', true),
('Bella''s Hair Studio', 'Our new website looks like we paid $10K for it. Clients love it and bookings doubled.', 5, 'beauty', true),
('Rodriguez Plumbing', 'Within 2 weeks of launching, we had to hire another tech to handle the new leads.', 5, 'plumbing', true),
('East Side Dental', 'Professional, fast, and the site actually brings in patients. Wish we did this sooner.', 5, 'dental', true),
('Tony''s Pizza', 'Online orders jumped 40% the first month. The site pays for itself every week.', 5, 'restaurant', true),
('CleanPro Services', 'They built exactly what we needed — clean, modern, and our phone hasn''t stopped ringing.', 5, 'cleaning', true);

-- Urgency tracking
CREATE TABLE IF NOT EXISTS public.brandaro_urgency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID,
  expires_at TIMESTAMPTZ NOT NULL,
  urgency_level TEXT DEFAULT 'standard',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_urgency ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read urgency" ON public.brandaro_urgency FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Auth manage urgency" ON public.brandaro_urgency FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Objection quick-actions
CREATE TABLE IF NOT EXISTS public.brandaro_objections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID,
  objection_type TEXT NOT NULL,
  resolved BOOLEAN DEFAULT false,
  response_sent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_objections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage objections" ON public.brandaro_objections FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Quality reviews for premium builds
CREATE TABLE IF NOT EXISTS public.brandaro_quality_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id UUID,
  lead_id UUID,
  status TEXT DEFAULT 'pending',
  reviewed_by UUID,
  notes TEXT,
  package_tier TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE public.brandaro_quality_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage quality reviews" ON public.brandaro_quality_reviews FOR ALL TO authenticated USING (true) WITH CHECK (true);
