
-- CHANGE 1: Provenance columns on stores
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS ingestion_source text;

-- CHANGE 2: Normalization function (used by both the index and the dedup RPC)
CREATE OR REPLACE FUNCTION public.normalize_store_address(
  p_street text,
  p_city text,
  p_state text,
  p_zip text
) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  norm_street text;
  norm_city text;
  norm_state text;
  norm_zip text;
BEGIN
  norm_street := lower(trim(coalesce(p_street, '')));
  norm_street := regexp_replace(norm_street, '[.,]', '', 'g');
  norm_street := regexp_replace(norm_street, '\mavenue\M', 'ave', 'gi');
  norm_street := regexp_replace(norm_street, '\mstreet\M', 'st', 'gi');
  norm_street := regexp_replace(norm_street, '\mroad\M', 'rd', 'gi');
  norm_street := regexp_replace(norm_street, '\mboulevard\M', 'blvd', 'gi');
  norm_street := regexp_replace(norm_street, '\mplace\M', 'pl', 'gi');
  norm_street := regexp_replace(norm_street, '\mcourt\M', 'ct', 'gi');
  norm_street := regexp_replace(norm_street, '\mdrive\M', 'dr', 'gi');
  norm_street := regexp_replace(norm_street, '\mlane\M', 'ln', 'gi');
  norm_street := regexp_replace(norm_street, '\mparkway\M', 'pkwy', 'gi');
  norm_street := regexp_replace(norm_street, '\mhighway\M', 'hwy', 'gi');
  norm_street := regexp_replace(norm_street, '\mthe\M', '', 'gi');
  norm_street := regexp_replace(norm_street, '\s+', ' ', 'g');
  norm_street := trim(norm_street);

  norm_city := lower(trim(coalesce(p_city, '')));
  norm_city := regexp_replace(norm_city, '\s+', ' ', 'g');
  IF norm_city IN (
    'new york', 'new york city', 'nyc', 'ny city',
    'brooklyn', 'bronx', 'the bronx',
    'manhattan', 'queens', 'staten island', 'staten is'
  ) THEN
    norm_city := 'nyc';
  END IF;

  norm_state := lower(trim(coalesce(p_state, '')));
  norm_state := regexp_replace(norm_state, '\s+', ' ', 'g');
  IF norm_state IN ('new york', 'ny') THEN
    norm_state := 'ny';
  END IF;

  norm_zip := trim(coalesce(p_zip, ''));
  norm_zip := regexp_replace(norm_zip, '\s+', ' ', 'g');

  RETURN trim(regexp_replace(
    concat_ws(' ',
      nullif(norm_street, ''),
      nullif(norm_city, ''),
      nullif(norm_state, ''),
      nullif(norm_zip, '')
    ),
    '\s+', ' ', 'g'
  ));
END;
$$;

-- CHANGE 3 helper: dedup-lookup RPC for the bulk uploader
CREATE OR REPLACE FUNCTION public.find_store_by_normalized_address(
  p_street text,
  p_city text,
  p_state text,
  p_zip text
) RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized text;
  v_id uuid;
BEGIN
  v_normalized := public.normalize_store_address(p_street, p_city, p_state, p_zip);

  IF v_normalized = '' THEN
    RETURN NULL;
  END IF;

  IF lower(coalesce(p_street, '')) ~ '\m(apt|apartment|unit|ste|suite)\M'
     OR coalesce(p_street, '') ~ '#' THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_id
  FROM public.stores
  WHERE deleted_at IS NULL
    AND public.normalize_store_address(address_street, address_city, address_state, address_zip) = v_normalized
  ORDER BY created_at ASC
  LIMIT 1;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_store_by_normalized_address(text, text, text, text) TO authenticated;

-- CHANGE 2A: Non-unique index (UNIQUE deferred until after merge phase)
CREATE INDEX IF NOT EXISTS stores_normalized_address_idx
  ON public.stores (public.normalize_store_address(address_street, address_city, address_state, address_zip))
  WHERE deleted_at IS NULL;
