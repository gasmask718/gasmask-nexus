
-- Add onboarding columns to beauty_providers
ALTER TABLE public.beauty_providers
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending_verification'
    CHECK (verification_status IN ('pending_verification','under_review','verified','rejected','suspended')),
  ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  ADD COLUMN IF NOT EXISTS license_url TEXT,
  ADD COLUMN IF NOT EXISTS insurance_url TEXT,
  ADD COLUMN IF NOT EXISTS independent_contractor BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS application_notes TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

-- Drop the old single-value category check and allow multi-category via specialties
-- Keep category as primary for backward compat

-- Create storage bucket for provider media
INSERT INTO storage.buckets (id, name, public) VALUES ('beauty-provider-media', 'beauty-provider-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view beauty media" ON storage.objects FOR SELECT USING (bucket_id = 'beauty-provider-media');
CREATE POLICY "Authenticated users can upload beauty media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'beauty-provider-media');
CREATE POLICY "Users can update own beauty media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'beauty-provider-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own beauty media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'beauty-provider-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Application tracking for admin review
CREATE TABLE public.beauty_provider_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.beauty_providers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','under_review','approved','rejected','needs_info')),
  reviewer_id UUID REFERENCES auth.users(id),
  reviewer_notes TEXT,
  portfolio_photo_count INTEGER NOT NULL DEFAULT 0,
  portfolio_video_count INTEGER NOT NULL DEFAULT 0,
  license_uploaded BOOLEAN NOT NULL DEFAULT false,
  insurance_uploaded BOOLEAN NOT NULL DEFAULT false,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.beauty_provider_applications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_beauty_apps_status ON public.beauty_provider_applications(status);
CREATE INDEX idx_beauty_apps_provider ON public.beauty_provider_applications(provider_id);

CREATE POLICY "Users view own application" ON public.beauty_provider_applications FOR SELECT TO authenticated
  USING (provider_id IN (SELECT id FROM public.beauty_providers WHERE user_id = auth.uid()));
CREATE POLICY "Users create application" ON public.beauty_provider_applications FOR INSERT TO authenticated
  WITH CHECK (provider_id IN (SELECT id FROM public.beauty_providers WHERE user_id = auth.uid()));
CREATE POLICY "Admins view all applications" ON public.beauty_provider_applications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update applications" ON public.beauty_provider_applications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_beauty_apps_updated_at BEFORE UPDATE ON public.beauty_provider_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
