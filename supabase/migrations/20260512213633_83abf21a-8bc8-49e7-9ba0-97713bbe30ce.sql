-- Phase 2: Storefront Captures Storage Bucket + RLS Policies
-- ============================================================

-- 1. Create the storage bucket for storefront captures
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'storefront-captures',
  'storefront-captures',
  true,
  5242880,  -- 5MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Public SELECT policy — anyone can view uploaded storefront photos
CREATE POLICY "Storefront captures are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'storefront-captures');

-- 3. INSERT policy — drivers, bikers, and ambassadors can upload
CREATE POLICY "Field roles can upload storefront captures"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'storefront-captures'
  AND (
    public.has_role(auth.uid(), 'driver'::public.app_role)
    OR public.has_role(auth.uid(), 'biker'::public.app_role)
    OR public.has_role(auth.uid(), 'ambassador'::public.app_role)
  )
);

-- 4. DELETE policy — only owner or admin can delete
CREATE POLICY "Only owner or admin can delete storefront captures"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'storefront-captures'
  AND (
    public.has_role(auth.uid(), 'owner'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);