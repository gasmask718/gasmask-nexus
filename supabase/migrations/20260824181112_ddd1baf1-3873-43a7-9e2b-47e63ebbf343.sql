INSERT INTO public.businesses (id, slug, name, is_active)
VALUES
  ('28a33ccc-cc51-42f2-9e44-dbd7654c9c7f', 'brightsun_solar', 'BrightSun Solar', true),
  ('d0e0fb05-a339-4704-bb51-e85e040a6358', 'dynasty_direct', 'Dynasty Direct', true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.communication_logs ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE public.communication_logs ALTER COLUMN business_id DROP NOT NULL;