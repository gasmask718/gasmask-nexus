INSERT INTO public.businesses (
  id, name, slug, industry, business_type, category, brand_type,
  tagline, short_description,
  primary_color, secondary_color, accent_color,
  is_active, subscription_tier, subscription_status,
  use_crm, communication_enabled, default_language, operational_status
) VALUES (
  gen_random_uuid(),
  'Brandaro',
  'brandaro',
  'digital_marketing',
  'services',
  'marketing_agency',
  'agency',
  'AI-Powered Brand Domination',
  'Brandaro is the AI-driven brand-building, lead-generation, and closing engine that turns prospects into long-term clients.',
  '#0EA5E9',
  '#1E293B',
  '#F59E0B',
  true,
  'enterprise',
  'active',
  true,
  true,
  'en',
  'active'
)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.brandaro_leads_master
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;

UPDATE public.brandaro_leads_master
SET business_id = (SELECT id FROM public.businesses WHERE slug = 'brandaro' LIMIT 1)
WHERE business_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_brandaro_leads_master_business_id
  ON public.brandaro_leads_master(business_id);