
-- Create toptier-assets storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('toptier-assets', 'toptier-assets', true);

-- Storage policies
CREATE POLICY "TopTier assets publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'toptier-assets');

CREATE POLICY "Authenticated users can upload toptier assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'toptier-assets');

CREATE POLICY "Authenticated users can update toptier assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'toptier-assets');

CREATE POLICY "Authenticated users can delete toptier assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'toptier-assets');

-- Add missing columns to tt_experiences
ALTER TABLE public.tt_experiences ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.tt_experiences ADD COLUMN IF NOT EXISTS gallery_images jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.tt_experiences ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;
ALTER TABLE public.tt_experiences ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
ALTER TABLE public.tt_experiences ADD COLUMN IF NOT EXISTS pricing_tier text;
ALTER TABLE public.tt_experiences ADD COLUMN IF NOT EXISTS pricing_notes text;

-- Add missing columns to tt_private_jets
ALTER TABLE public.tt_private_jets ADD COLUMN IF NOT EXISTS gallery_images jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.tt_private_jets ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;
ALTER TABLE public.tt_private_jets ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- Add missing columns to tt_affiliates
ALTER TABLE public.tt_affiliates ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.tt_affiliates ADD COLUMN IF NOT EXISTS commission_override numeric;
ALTER TABLE public.tt_affiliates ADD COLUMN IF NOT EXISTS category text;

-- Add missing columns to tt_partners
ALTER TABLE public.tt_partners ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.tt_partners ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE public.tt_partners ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.tt_partners ADD COLUMN IF NOT EXISTS commission_rate numeric DEFAULT 15;
