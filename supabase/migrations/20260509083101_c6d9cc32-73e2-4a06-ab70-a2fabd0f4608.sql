
CREATE TABLE IF NOT EXISTS public.address_extraction_staging (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  original_name text,
  original_address text,
  extracted_address text,
  extracted_source text,
  confidence text,
  review_status text DEFAULT 'pending',
  extracted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.address_extraction_staging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read address_extraction_staging" ON public.address_extraction_staging;
CREATE POLICY "auth read address_extraction_staging"
  ON public.address_extraction_staging FOR SELECT
  TO authenticated USING (true);

WITH src AS (
  SELECT
    s.id AS store_id,
    s.name AS original_name,
    s.address_street AS original_address,
    (regexp_match(
       COALESCE(s.name,''),
       '(\d+(?:-\d+)?\s+[A-Za-z][A-Za-z0-9\.\s]*?\s+(?:ave|avenue|st|street|rd|road|pkwy|parkway|blvd|boulevard|way|place|pl|drive|dr|court|ct))',
       'i'
    ))[1] AS name_match,
    (regexp_match(
       COALESCE(s.address_street,''),
       '(\d+(?:-\d+)?\s+[A-Za-z][A-Za-z0-9\.\s]*?\s+(?:ave|avenue|st|street|rd|road|pkwy|parkway|blvd|boulevard|way|place|pl|drive|dr|court|ct))',
       'i'
    ))[1] AS addr_match,
    (COALESCE(s.name,'') ~* '\(\s*\d+(?:-\d+)?\s+[A-Za-z][^)]*?(ave|avenue|st|street|rd|road|pkwy|parkway|blvd|boulevard|way|place|pl|drive|dr|court|ct)\b[^)]*\)') AS name_paren
  FROM public.stores s
  JOIN public.v_reactivation_targets t ON t.store_id = s.id
  WHERE (s.address_street IS NULL OR s.address_street = ''
         OR s.address_zip IS NULL OR s.address_zip = '')
)
INSERT INTO public.address_extraction_staging
  (store_id, original_name, original_address, extracted_address, extracted_source, confidence)
SELECT
  store_id,
  original_name,
  original_address,
  COALESCE(name_match, addr_match),
  CASE WHEN name_match IS NOT NULL THEN 'name'
       WHEN addr_match IS NOT NULL THEN 'address_street'
       ELSE NULL END,
  CASE
    WHEN name_match IS NOT NULL AND name_paren THEN 'high'
    WHEN name_match IS NOT NULL THEN 'medium'
    WHEN addr_match IS NOT NULL THEN 'medium'
    ELSE 'low'
  END
FROM src
WHERE COALESCE(name_match, addr_match) IS NOT NULL
ON CONFLICT (store_id) DO NOTHING;
