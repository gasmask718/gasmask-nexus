-- Add PostGrid letter ID to mailing log
ALTER TABLE public.funding_mailing_log
ADD COLUMN IF NOT EXISTS postgrid_letter_id TEXT;

-- Create funding_client_documents table
CREATE TABLE IF NOT EXISTS public.funding_client_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.funding_clients(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  file_size BIGINT,
  lender_packages JSONB DEFAULT '[]'::jsonb
);

ALTER TABLE public.funding_client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage funding documents"
ON public.funding_client_documents
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Create funding-documents storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('funding-documents', 'funding-documents', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view funding documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'funding-documents');

CREATE POLICY "Authenticated users can upload funding documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'funding-documents');

CREATE POLICY "Authenticated users can delete funding documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'funding-documents');