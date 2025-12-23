-- Add required Business Registry fields
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS business_type text,
ADD COLUMN IF NOT EXISTS industry text,
ADD COLUMN IF NOT EXISTS communication_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS channels_enabled text[] DEFAULT ARRAY['call', 'text', 'email'],
ADD COLUMN IF NOT EXISTS compliance_profile text;

-- Add index for business_code/slug lookups
CREATE INDEX IF NOT EXISTS idx_businesses_slug ON public.businesses(slug);
CREATE INDEX IF NOT EXISTS idx_businesses_active ON public.businesses(is_active) WHERE is_active = true;