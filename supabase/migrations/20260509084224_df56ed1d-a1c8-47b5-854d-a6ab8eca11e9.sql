
-- B prep: extend staging
ALTER TABLE public.address_extraction_staging
  ADD COLUMN IF NOT EXISTS resolved_address text,
  ADD COLUMN IF NOT EXISTS resolved_zip text,
  ADD COLUMN IF NOT EXISTS resolved_neighborhood text,
  ADD COLUMN IF NOT EXISTS resolved_boro text,
  ADD COLUMN IF NOT EXISTS resolved_lat numeric,
  ADD COLUMN IF NOT EXISTS resolved_lng numeric,
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS geocode_status text,
  ADD COLUMN IF NOT EXISTS geocode_error text,
  ADD COLUMN IF NOT EXISTS geocoded_at timestamptz;

-- B.6: typo fix
UPDATE public.stores
SET name = REPLACE(name, '243rd StRosedale', '243rd St Rosedale')
WHERE name LIKE '%243rd StRosedale%';

-- B.6: re-extract this one store using widened patterns
INSERT INTO public.address_extraction_staging
  (store_id, original_name, original_address, extracted_address, extracted_source, confidence, review_status)
SELECT s.id, s.name, s.address_street,
  (regexp_match(s.name, '(\d+(-\d+)?\s+\d+(st|nd|rd|th)\s+St)','i'))[1],
  'pattern2b_ordinal_st_postfix',
  'high',
  'pending'
FROM public.stores s
WHERE s.name LIKE '%243rd St Rosedale%'
  AND (regexp_match(s.name, '(\d+(-\d+)?\s+\d+(st|nd|rd|th)\s+St)','i'))[1] IS NOT NULL
ON CONFLICT (store_id) DO NOTHING;

-- E1: field capture queue
CREATE TABLE IF NOT EXISTS public.field_capture_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'address_unresolvable',
  priority int NOT NULL DEFAULT 0,
  assigned_ambassador_id uuid,
  assigned_at timestamptz,
  captured_at timestamptz,
  captured_by uuid,
  capture_data jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','assigned','captured','verified','defunct')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, reason)
);

CREATE INDEX IF NOT EXISTS idx_fcq_status_prio
  ON public.field_capture_queue (status, priority DESC, assigned_ambassador_id);

ALTER TABLE public.field_capture_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fcq read auth" ON public.field_capture_queue;
CREATE POLICY "fcq read auth"
  ON public.field_capture_queue FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "fcq update assigned ambassador" ON public.field_capture_queue;
CREATE POLICY "fcq update assigned ambassador"
  ON public.field_capture_queue FOR UPDATE
  TO authenticated
  USING (assigned_ambassador_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (assigned_ambassador_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS "fcq insert admin" ON public.field_capture_queue;
CREATE POLICY "fcq insert admin"
  ON public.field_capture_queue FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
