
-- Add dual-engine fields to brandaro_demo_sites
ALTER TABLE public.brandaro_demo_sites
  ADD COLUMN IF NOT EXISTS generation_engine text NOT NULL DEFAULT 'native',
  ADD COLUMN IF NOT EXISTS engine_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS preview_image text,
  ADD COLUMN IF NOT EXISTS template_used text,
  ADD COLUMN IF NOT EXISTS hosting_path text,
  ADD COLUMN IF NOT EXISTS durable_site_id text,
  ADD COLUMN IF NOT EXISTS generated_html text;

-- Create demo site templates table for native generator
CREATE TABLE IF NOT EXISTS public.brandaro_demo_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry text NOT NULL UNIQUE,
  template_name text NOT NULL,
  hero_headline text NOT NULL,
  hero_subheadline text NOT NULL,
  color_scheme jsonb DEFAULT '{"primary": "#2563eb", "accent": "#f59e0b"}'::jsonb,
  sections jsonb DEFAULT '[]'::jsonb,
  cta_text text DEFAULT 'Get Your Free Quote',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.brandaro_demo_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read demo templates"
  ON public.brandaro_demo_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage demo templates"
  ON public.brandaro_demo_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default industry templates
INSERT INTO public.brandaro_demo_templates (industry, template_name, hero_headline, hero_subheadline, cta_text) VALUES
  ('plumber', 'Professional Plumbing', 'Your Trusted Local Plumber', 'Fast, reliable plumbing services for your home and business', 'Schedule Service Today'),
  ('hvac', 'HVAC Excellence', 'Keep Your Home Comfortable Year-Round', 'Expert heating and cooling solutions you can count on', 'Get a Free Estimate'),
  ('roofing', 'Premier Roofing', 'Protecting What Matters Most', 'Quality roofing repair and installation by certified professionals', 'Free Roof Inspection'),
  ('electrician', 'Expert Electrical', 'Safe & Reliable Electrical Services', 'Licensed electricians providing residential and commercial solutions', 'Book an Electrician'),
  ('landscaping', 'Beautiful Landscapes', 'Transform Your Outdoor Space', 'Professional lawn care, design, and maintenance services', 'Free Consultation'),
  ('restaurant', 'Fine Dining Experience', 'Unforgettable Flavors Await', 'Fresh ingredients, passionate chefs, and a welcoming atmosphere', 'Reserve a Table'),
  ('auto_repair', 'Trusted Auto Repair', 'Keeping You on the Road', 'Honest, affordable auto repair and maintenance services', 'Book Appointment'),
  ('general', 'Professional Services', 'Excellence in Every Detail', 'Trusted professionals dedicated to quality and customer satisfaction', 'Contact Us Today')
ON CONFLICT (industry) DO NOTHING;
