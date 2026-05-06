CREATE OR REPLACE FUNCTION public.preview_pass2_extraction()
RETURNS TABLE (
  store_id uuid,
  current_name text,
  pattern_type text,
  extracted_address text,
  proposed_name text,
  conflict boolean,
  conflict_reason text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH empty_stores AS (
    SELECT s.id, s.name, s.address_street
    FROM stores s
    WHERE s.deleted_at IS NULL
      AND COALESCE(TRIM(s.address_street),'') = ''
  ),
  prefix_extractions AS (
    SELECT
      e.id AS store_id,
      e.name AS current_name,
      'prefix'::text AS pattern_type,
      TRIM((regexp_match(e.name, '^\((\d[\d\- ]*\s+[^)]+)\)'))[1]) AS extracted_address,
      TRIM(regexp_replace(e.name, '^\(\d[\d\- ]*\s+[^)]+\)\s*', '')) AS proposed_name
    FROM empty_stores e
    WHERE e.name ~ '^\(\d[\d\- ]*\s+'
  ),
  suffix_extractions AS (
    SELECT
      e.id AS store_id,
      e.name AS current_name,
      'suffix'::text AS pattern_type,
      TRIM((regexp_match(e.name, '\((\d[\d\- ]*\s+[^)]+)\)'))[1]) AS extracted_address,
      TRIM(regexp_replace(e.name, '\s*\(\d[\d\- ]*\s+[^)]+\)\s*$', '')) AS proposed_name
    FROM empty_stores e
    WHERE e.name ~ '\(\d[\d\- ]*\s+[A-Za-z]'
      AND e.id NOT IN (SELECT store_id FROM prefix_extractions)
  ),
  combined AS (
    SELECT * FROM prefix_extractions
    UNION ALL
    SELECT * FROM suffix_extractions
  )
  SELECT
    p.store_id, p.current_name, p.pattern_type,
    p.extracted_address, p.proposed_name,
    CASE
      WHEN p.extracted_address IS NULL THEN true
      WHEN length(p.extracted_address) < 5 THEN true
      WHEN length(p.extracted_address) > 80 THEN true
      WHEN p.extracted_address !~ '\d' THEN true
      ELSE false
    END AS conflict,
    CASE
      WHEN p.extracted_address IS NULL THEN 'Extraction returned null'
      WHEN length(p.extracted_address) < 5 THEN 'Address too short'
      WHEN length(p.extracted_address) > 80 THEN 'Address suspiciously long'
      WHEN p.extracted_address !~ '\d' THEN 'No street number found'
      ELSE NULL
    END AS conflict_reason
  FROM combined p;
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_pass2_extraction() TO authenticated;