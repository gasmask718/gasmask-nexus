
-- Template Performance Tracking
CREATE TABLE public.brandaro_template_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.brandaro_extracted_templates(id) ON DELETE CASCADE,
  build_job_id uuid,
  client_id uuid,
  usage_count integer DEFAULT 0,
  conversion_rate numeric DEFAULT 0,
  avg_engagement_seconds numeric DEFAULT 0,
  avg_scroll_depth numeric DEFAULT 0,
  lead_generation_rate numeric DEFAULT 0,
  template_score numeric DEFAULT 50,
  score_breakdown jsonb DEFAULT '{}',
  last_scored_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.brandaro_template_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read template performance"
  ON public.brandaro_template_performance FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role manages template performance"
  ON public.brandaro_template_performance FOR ALL TO service_role USING (true);

-- Design Profiles (Style DNA)
CREATE TABLE public.brandaro_design_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_name text NOT NULL,
  style_category text NOT NULL, -- modern, bold, minimal, luxury, corporate, local_service
  spacing_system jsonb DEFAULT '{"section_padding": "5rem", "element_gap": "2rem"}',
  color_palette jsonb DEFAULT '{}',
  font_pairing jsonb DEFAULT '{}',
  cta_style text DEFAULT 'standard', -- aggressive, subtle, standard
  cta_placement text DEFAULT 'hero_and_footer', -- hero_only, hero_and_footer, every_section
  layout_preference text DEFAULT 'mixed', -- full_width, narrow, mixed, asymmetric
  usage_count integer DEFAULT 0,
  avg_conversion_rate numeric DEFAULT 0,
  performance_rank integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.brandaro_design_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read design profiles"
  ON public.brandaro_design_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role manages design profiles"
  ON public.brandaro_design_profiles FOR ALL TO service_role USING (true);

-- Add design_profile_id to build jobs for tracking which profile was used
ALTER TABLE public.brandaro_build_jobs
  ADD COLUMN IF NOT EXISTS design_profile_id uuid REFERENCES public.brandaro_design_profiles(id),
  ADD COLUMN IF NOT EXISTS template_performance_id uuid;

-- Add performance columns to extracted_templates
ALTER TABLE public.brandaro_extracted_templates
  ADD COLUMN IF NOT EXISTS usage_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

-- Seed default design profiles
INSERT INTO public.brandaro_design_profiles (profile_name, style_category, color_palette, font_pairing, cta_style, cta_placement, layout_preference) VALUES
  ('Corporate Pro', 'corporate', '{"primary":"#1e40af","secondary":"#0369a1","accent":"#06b6d4","bg":"#f8fafc","text":"#0f172a"}', '{"heading":"Montserrat","body":"Open Sans"}', 'standard', 'hero_and_footer', 'narrow'),
  ('Bold Impact', 'bold', '{"primary":"#1e1b4b","secondary":"#312e81","accent":"#818cf8","bg":"#eef2ff","text":"#1e1b4b"}', '{"heading":"Space Grotesk","body":"DM Sans"}', 'aggressive', 'every_section', 'full_width'),
  ('Minimal Clean', 'minimal', '{"primary":"#334155","secondary":"#475569","accent":"#38bdf8","bg":"#f1f5f9","text":"#0f172a"}', '{"heading":"Inter","body":"Inter"}', 'subtle', 'hero_and_footer', 'narrow'),
  ('Luxury Estate', 'luxury', '{"primary":"#7e22ce","secondary":"#a855f7","accent":"#c084fc","bg":"#faf5ff","text":"#3b0764"}', '{"heading":"Cinzel","body":"Raleway"}', 'subtle', 'hero_only', 'asymmetric'),
  ('Local Service', 'local_service', '{"primary":"#166534","secondary":"#15803d","accent":"#84cc16","bg":"#f0fdf4","text":"#14532d"}', '{"heading":"Playfair Display","body":"Lato"}', 'aggressive', 'every_section', 'mixed'),
  ('Modern Edge', 'modern', '{"primary":"#18181b","secondary":"#3f3f46","accent":"#f97316","bg":"#fafafa","text":"#09090b"}', '{"heading":"Oswald","body":"Roboto"}', 'standard', 'hero_and_footer', 'full_width');
