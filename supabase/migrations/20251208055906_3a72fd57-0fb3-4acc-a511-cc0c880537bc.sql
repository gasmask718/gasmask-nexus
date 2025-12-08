-- ═══════════════════════════════════════════════════════════════════════════════
-- V5.1: VERTICAL ENFORCEMENT SYSTEM
-- Brand Verticals, Cross-Promotion Rules, and Pitch Permissions
-- ═══════════════════════════════════════════════════════════════════════════════

-- Brand Verticals (category groupings)
CREATE TABLE public.brand_verticals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  industry text NOT NULL,
  allow_cross_vertical boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.brand_verticals ENABLE ROW LEVEL SECURITY;

-- Public read access (verticals are configuration data)
CREATE POLICY "Anyone can read brand verticals"
  ON public.brand_verticals FOR SELECT USING (true);

-- Admin-only write access
CREATE POLICY "Admins can manage brand verticals"
  ON public.brand_verticals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Vertical Brands (maps brands to verticals)
CREATE TABLE public.vertical_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id uuid NOT NULL REFERENCES public.brand_verticals(id) ON DELETE CASCADE,
  brand_id text NOT NULL,
  brand_name text NOT NULL,
  can_cross_promote boolean DEFAULT true,
  pitch_priority integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(vertical_id, brand_id)
);

-- Enable RLS
ALTER TABLE public.vertical_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read vertical brands"
  ON public.vertical_brands FOR SELECT USING (true);

CREATE POLICY "Admins can manage vertical brands"
  ON public.vertical_brands FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Vertical Pitch Rules (what can be pitched to whom)
CREATE TABLE public.vertical_pitch_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id uuid NOT NULL REFERENCES public.brand_verticals(id) ON DELETE CASCADE,
  rule_type text NOT NULL,
  rule_value text NOT NULL,
  severity text DEFAULT 'block',
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vertical_pitch_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read vertical pitch rules"
  ON public.vertical_pitch_rules FOR SELECT USING (true);

CREATE POLICY "Admins can manage vertical pitch rules"
  ON public.vertical_pitch_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Store Vertical Assignments
CREATE TABLE public.store_vertical_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  vertical_id uuid NOT NULL REFERENCES public.brand_verticals(id) ON DELETE CASCADE,
  can_receive_pitch boolean DEFAULT true,
  allowed_brands text[] DEFAULT '{}',
  forbidden_brands text[] DEFAULT '{}',
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(store_id, vertical_id)
);

-- Enable RLS
ALTER TABLE public.store_vertical_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read store vertical permissions"
  ON public.store_vertical_permissions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage store vertical permissions"
  ON public.store_vertical_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add vertical_id to campaigns
ALTER TABLE public.ai_call_campaigns 
ADD COLUMN IF NOT EXISTS vertical_id uuid REFERENCES public.brand_verticals(id);

-- Add vertical_id to deals
ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS vertical_id uuid REFERENCES public.brand_verticals(id);

-- AI Script Guardrails (per vertical)
CREATE TABLE public.vertical_script_guardrails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id uuid NOT NULL REFERENCES public.brand_verticals(id) ON DELETE CASCADE,
  guardrail_type text NOT NULL,
  guardrail_value text NOT NULL,
  priority integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vertical_script_guardrails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read vertical script guardrails"
  ON public.vertical_script_guardrails FOR SELECT USING (true);

CREATE POLICY "Admins can manage vertical script guardrails"
  ON public.vertical_script_guardrails FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Insert default verticals
INSERT INTO public.brand_verticals (name, slug, description, industry, allow_cross_vertical) VALUES
('Grabba & Tobacco', 'grabba-tobacco', 'All grabba products, tubes, accessories, and tobacco-related items', 'tobacco', false),
('Luxury & Lifestyle', 'luxury-lifestyle', 'Premium experiences, chauffeur services, and high-end events', 'luxury', false),
('Adult & Creator Economy', 'adult-creator', 'Adult content platforms and creator services', 'adult', false),
('Business Services', 'business-services', 'Funding, credit, and business operations services', 'services', false);

-- Insert brands and guardrails
DO $$
DECLARE
  grabba_vertical_id uuid;
  luxury_vertical_id uuid;
  adult_vertical_id uuid;
BEGIN
  SELECT id INTO grabba_vertical_id FROM public.brand_verticals WHERE slug = 'grabba-tobacco';
  SELECT id INTO luxury_vertical_id FROM public.brand_verticals WHERE slug = 'luxury-lifestyle';
  SELECT id INTO adult_vertical_id FROM public.brand_verticals WHERE slug = 'adult-creator';
  
  -- Insert Grabba family brands
  INSERT INTO public.vertical_brands (vertical_id, brand_id, brand_name, can_cross_promote, pitch_priority) VALUES
  (grabba_vertical_id, 'gasmask', 'GasMask', true, 1),
  (grabba_vertical_id, 'hotmama', 'Hot Mama', true, 2),
  (grabba_vertical_id, 'scalati', 'Hot Scolatti', true, 3),
  (grabba_vertical_id, 'grabba', 'Grabba R Us', true, 4);
  
  -- Insert Luxury brands
  INSERT INTO public.vertical_brands (vertical_id, brand_id, brand_name, can_cross_promote, pitch_priority) VALUES
  (luxury_vertical_id, 'toptier', 'TopTier Experience', true, 1),
  (luxury_vertical_id, 'unforgettable', 'Unforgettable Times', true, 2);
  
  -- Insert Adult brands
  INSERT INTO public.vertical_brands (vertical_id, brand_id, brand_name, can_cross_promote, pitch_priority) VALUES
  (adult_vertical_id, 'playboxxx', 'Playboxxx', true, 1);
  
  -- Insert Grabba vertical guardrails
  INSERT INTO public.vertical_script_guardrails (vertical_id, guardrail_type, guardrail_value, priority) VALUES
  (grabba_vertical_id, 'system_prompt_prefix', 'You are speaking to a smoke shop within the Grabba & Tobacco vertical. You may ONLY discuss products in this vertical: GasMask, Hot Mama, Grabba R Us, Hot Scolatti, tubes, bags, lighters, and tobacco accessories.', 1),
  (grabba_vertical_id, 'forbidden_mention', 'Playboxxx', 1),
  (grabba_vertical_id, 'forbidden_mention', 'TopTier', 2),
  (grabba_vertical_id, 'forbidden_mention', 'Unforgettable Times', 3),
  (grabba_vertical_id, 'forbidden_mention', 'adult content', 4),
  (grabba_vertical_id, 'forbidden_mention', 'luxury experience', 5),
  (grabba_vertical_id, 'forbidden_mention', 'chauffeur', 6),
  (grabba_vertical_id, 'required_disclaimer', 'Focus only on wholesale tobacco products and accessories.', 1);
  
  -- Insert pitch rules for Grabba vertical
  INSERT INTO public.vertical_pitch_rules (vertical_id, rule_type, rule_value, severity) VALUES
  (grabba_vertical_id, 'allowed_topics', 'tubes', 'log'),
  (grabba_vertical_id, 'allowed_topics', 'bags', 'log'),
  (grabba_vertical_id, 'allowed_topics', 'grabba', 'log'),
  (grabba_vertical_id, 'allowed_topics', 'boxes', 'log'),
  (grabba_vertical_id, 'allowed_topics', 'lighters', 'log'),
  (grabba_vertical_id, 'allowed_topics', 'accessories', 'log'),
  (grabba_vertical_id, 'allowed_topics', 'flavors', 'log'),
  (grabba_vertical_id, 'allowed_topics', 'discounts', 'log'),
  (grabba_vertical_id, 'allowed_topics', 'delivery', 'log'),
  (grabba_vertical_id, 'forbidden_topics', 'Playboxxx', 'block'),
  (grabba_vertical_id, 'forbidden_topics', 'TopTier Experience', 'block'),
  (grabba_vertical_id, 'forbidden_topics', 'adult services', 'block'),
  (grabba_vertical_id, 'forbidden_topics', 'luxury events', 'block'),
  (grabba_vertical_id, 'forbidden_topics', 'chauffeur', 'block'),
  (grabba_vertical_id, 'forbidden_topics', 'creator economy', 'block');
END $$;

-- Create function to check if a brand can be pitched to a store
CREATE OR REPLACE FUNCTION public.can_pitch_brand_to_store(
  p_store_id uuid,
  p_brand_id text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_brand_vertical_id uuid;
  v_store_permission record;
BEGIN
  SELECT vertical_id INTO v_brand_vertical_id
  FROM public.vertical_brands
  WHERE brand_id = p_brand_id;
  
  IF v_brand_vertical_id IS NULL THEN
    RETURN true;
  END IF;
  
  SELECT * INTO v_store_permission
  FROM public.store_vertical_permissions
  WHERE store_id = p_store_id AND vertical_id = v_brand_vertical_id;
  
  IF v_store_permission IS NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.store_master s
      JOIN public.brand_verticals v ON v.id = v_brand_vertical_id
      WHERE s.id = p_store_id
      AND (s.store_type ILIKE '%smoke%' OR s.store_type ILIKE '%tobacco%' OR s.store_type ILIKE '%convenience%')
      AND v.industry = 'tobacco'
    );
  END IF;
  
  IF p_brand_id = ANY(v_store_permission.forbidden_brands) THEN
    RETURN false;
  END IF;
  
  IF array_length(v_store_permission.allowed_brands, 1) > 0 THEN
    RETURN p_brand_id = ANY(v_store_permission.allowed_brands);
  END IF;
  
  RETURN v_store_permission.can_receive_pitch;
END;
$$;

-- Create function to get allowed brands for a store
CREATE OR REPLACE FUNCTION public.get_allowed_brands_for_store(
  p_store_id uuid
) RETURNS TABLE(brand_id text, brand_name text, vertical_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT vb.brand_id, vb.brand_name, bv.name as vertical_name
  FROM public.vertical_brands vb
  JOIN public.brand_verticals bv ON bv.id = vb.vertical_id
  WHERE public.can_pitch_brand_to_store(p_store_id, vb.brand_id);
END;
$$;

-- Create function to get script guardrails for a vertical
CREATE OR REPLACE FUNCTION public.get_vertical_guardrails(
  p_vertical_slug text
) RETURNS TABLE(guardrail_type text, guardrail_value text, priority integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT vsg.guardrail_type, vsg.guardrail_value, vsg.priority
  FROM public.vertical_script_guardrails vsg
  JOIN public.brand_verticals bv ON bv.id = vsg.vertical_id
  WHERE bv.slug = p_vertical_slug
  AND vsg.is_active = true
  ORDER BY vsg.priority;
END;
$$;