-- Audit log table
CREATE TABLE IF NOT EXISTS public.dynasty_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  related_entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  performed_by uuid,
  performed_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  session_label text
);

CREATE INDEX IF NOT EXISTS idx_dynasty_change_log_type ON public.dynasty_change_log(change_type);
CREATE INDEX IF NOT EXISTS idx_dynasty_change_log_entity ON public.dynasty_change_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_dynasty_change_log_session ON public.dynasty_change_log(session_label);
CREATE INDEX IF NOT EXISTS idx_dynasty_change_log_performed_at ON public.dynasty_change_log(performed_at DESC);

ALTER TABLE public.dynasty_change_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dynasty_change_log' AND policyname='Admins can view change log') THEN
    CREATE POLICY "Admins can view change log" ON public.dynasty_change_log
      FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dynasty_change_log' AND policyname='Admins can insert change log') THEN
    CREATE POLICY "Admins can insert change log" ON public.dynasty_change_log
      FOR INSERT TO authenticated
      WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));
  END IF;
END $$;

-- Detection function
CREATE OR REPLACE FUNCTION public.detect_store_address_duplicates()
RETURNS TABLE (
  duplicate_group_id integer,
  normalized_address text,
  store_count bigint,
  store_ids uuid[],
  store_names text[],
  raw_addresses text[],
  phones text[],
  created_dates timestamptz[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      s.id,
      s.name,
      TRIM(CONCAT_WS(' ',
        NULLIF(TRIM(s.address_street), ''),
        NULLIF(TRIM(s.address_city), ''),
        NULLIF(TRIM(s.address_state), ''),
        NULLIF(TRIM(s.address_zip), '')
      )) AS raw_address,
      s.address_street,
      s.phone,
      s.created_at
    FROM public.stores s
    WHERE s.address_street IS NOT NULL
      AND TRIM(s.address_street) <> ''
      AND s.deleted_at IS NULL
  ),
  -- Skip rows that contain apt/unit/suite designations to avoid grouping different units together
  filtered AS (
    SELECT *
    FROM base
    WHERE raw_address !~* '\m(apt|apartment|unit|ste|suite|#)\M'
  ),
  normalized AS (
    SELECT
      id, name, raw_address, phone, created_at,
      LOWER(TRIM(REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                REGEXP_REPLACE(
                  REGEXP_REPLACE(
                    REGEXP_REPLACE(
                      REGEXP_REPLACE(
                        REGEXP_REPLACE(
                          REGEXP_REPLACE(
                            REGEXP_REPLACE(
                              REGEXP_REPLACE(raw_address, '[.,]', '', 'g'),
                            '\mavenue\M', 'ave', 'gi'),
                          '\mstreet\M', 'st', 'gi'),
                        '\mroad\M', 'rd', 'gi'),
                      '\mboulevard\M', 'blvd', 'gi'),
                    '\mplace\M', 'pl', 'gi'),
                  '\mcourt\M', 'ct', 'gi'),
                '\mdrive\M', 'dr', 'gi'),
              '\mlane\M', 'ln', 'gi'),
            '\mparkway\M', 'pkwy', 'gi'),
          '\mhighway\M', 'hwy', 'gi'),
        '\mthe\M', '', 'gi'),
      '\s+', ' ', 'g'))) AS norm_address
    FROM filtered
  ),
  groups AS (
    SELECT
      norm_address,
      COUNT(*) AS cnt,
      ARRAY_AGG(id ORDER BY created_at) AS ids,
      ARRAY_AGG(name ORDER BY created_at) AS names,
      ARRAY_AGG(raw_address ORDER BY created_at) AS raws,
      ARRAY_AGG(phone ORDER BY created_at) AS phs,
      ARRAY_AGG(created_at ORDER BY created_at) AS dates
    FROM normalized
    WHERE norm_address <> ''
    GROUP BY norm_address
    HAVING COUNT(*) > 1
  )
  SELECT
    (ROW_NUMBER() OVER (ORDER BY cnt DESC, norm_address))::integer,
    norm_address,
    cnt,
    ids, names, raws, phs, dates
  FROM groups
  ORDER BY cnt DESC, norm_address;
END;
$$;

GRANT EXECUTE ON FUNCTION public.detect_store_address_duplicates() TO authenticated;