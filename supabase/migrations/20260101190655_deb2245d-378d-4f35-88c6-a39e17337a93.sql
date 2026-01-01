-- Create storage bucket for staff documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ut-staff-documents',
  'ut-staff-documents',
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for ut-staff-documents bucket
CREATE POLICY "Authenticated users can upload staff documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ut-staff-documents');

CREATE POLICY "Authenticated users can view staff documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'ut-staff-documents');

CREATE POLICY "Authenticated users can update staff documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'ut-staff-documents');

CREATE POLICY "Authenticated users can delete staff documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'ut-staff-documents');