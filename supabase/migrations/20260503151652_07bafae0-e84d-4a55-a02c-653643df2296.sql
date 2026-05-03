CREATE OR REPLACE FUNCTION public.detect_store_address_duplicates()
RETURNS TABLE(
  duplicate_group_id integer,
  normalized_address text,
  store_count bigint,
  store_ids uuid[],
  store_names text[],
  raw_addresses text[],
  phones text[],
  created_dates timestamp with time zone[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH normalized AS (
    SELECT
      s.id,
      s.name,
      COALESCE(NULLIF(TRIM(CONCAT_WS(' ',
        NULLIF(TRIM(s.address_street), ''),
        NULLIF(TRIM(s.address_city), ''),
        NULLIF(TRIM(s.address_state), ''),
        NULLIF(TRIM(s.address_zip), '')
      )), ''), '') AS raw_addr,
      s.phone,
      s.created_at,
      -- Normalize street: lowercase, strip punctuation, collapse ws, suffix expansions
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    regexp_replace(
                      regexp_replace(
                        regexp_replace(
                          lower(COALESCE(s.address_street, '')),
                          '[.,]', '', 'g'),
                        '\s+', ' ', 'g'),
                      '\mavenue\M', 'ave', 'g'),
                    '\mstreet\M', 'st', 'g'),
                  '\mboulevard\M', 'blvd', 'g'),
                '\mroad\M', 'rd', 'g'),
              '\mdrive\M', 'dr', 'g'),
            '\mplace\M', 'pl', 'g'),
          '\mparkway\M', 'pkwy', 'g'),
        '\m(highway|hwy)\M', 'hwy', 'g'
      ) AS norm_street,
      -- Normalize city with NYC borough collapse
      CASE
        WHEN regexp_replace(lower(TRIM(COALESCE(s.address_city, ''))), '\s+', ' ', 'g') IN (
          'new york', 'new york city', 'nyc', 'ny city',
          'brooklyn', 'bronx', 'the bronx', 'manhattan',
          'queens', 'staten island', 'staten is'
        ) THEN 'nyc'
        ELSE regexp_replace(lower(TRIM(COALESCE(s.address_city, ''))), '\s+', ' ', 'g')
      END AS norm_city,
      -- Normalize state (ny / new york -> ny)
      CASE
        WHEN regexp_replace(lower(TRIM(COALESCE(s.address_state, ''))), '\s+', ' ', 'g') IN ('ny', 'new york')
          THEN 'ny'
        ELSE regexp_replace(lower(TRIM(COALESCE(s.address_state, ''))), '\s+', ' ', 'g')
      END AS norm_state,
      regexp_replace(TRIM(COALESCE(s.address_zip, '')), '\s+', ' ', 'g') AS norm_zip
    FROM stores s
    WHERE s.deleted_at IS NULL
      AND COALESCE(s.address_street, '') <> ''
      AND lower(COALESCE(s.address_street, '')) !~ '\m(apt|apartment|unit|ste|suite)\M'
      AND COALESCE(s.address_street, '') !~ '#'
  ),
  combined AS (
    SELECT
      n.id,
      n.name,
      n.raw_addr,
      n.phone,
      n.created_at,
      TRIM(BOTH ' ' FROM regexp_replace(
        CONCAT_WS(' ', NULLIF(n.norm_street, ''), NULLIF(n.norm_city, ''), NULLIF(n.norm_state, ''), NULLIF(n.norm_zip, '')),
        '\s+', ' ', 'g'
      )) AS norm_full
    FROM normalized n
    WHERE n.norm_street <> ''
  ),
  grouped AS (
    SELECT
      norm_full,
      COUNT(*) AS cnt,
      array_agg(id ORDER BY created_at) AS ids,
      array_agg(name ORDER BY created_at) AS names,
      array_agg(raw_addr ORDER BY created_at) AS raws,
      array_agg(phone ORDER BY created_at) AS phs,
      array_agg(created_at ORDER BY created_at) AS dates
    FROM combined
    GROUP BY norm_full
    HAVING COUNT(*) > 1
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY g.cnt DESC, g.norm_full)::int,
    g.norm_full,
    g.cnt,
    g.ids,
    g.names,
    g.raws,
    g.phs,
    g.dates
  FROM grouped g
  ORDER BY g.cnt DESC, g.norm_full;
END;
$$;