
CREATE OR REPLACE FUNCTION public.detect_store_phone_name_duplicates()
RETURNS TABLE (
  phone_name_group_id   integer,
  norm_name             text,
  norm_phone            text,
  group_size            integer,
  store_id              uuid,
  store_name            text,
  raw_address           text,
  phone                 text,
  created_at            timestamptz,
  is_winner             boolean,
  is_owner_cluster_candidate boolean,
  needs_review          boolean,
  review_reason         text,
  distinct_addresses    integer,
  distinct_names        integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      s.id AS sid, s.name AS sname,
      lower(trim(COALESCE(NULLIF(sm.store_name,''), s.name, ''))) AS nname_raw,
      regexp_replace(COALESCE(NULLIF(s.phone,''), sm.phone, ''), '\D', '', 'g') AS nphone,
      COALESCE(NULLIF(TRIM(CONCAT_WS(' ',
        NULLIF(TRIM(s.address_street),''),
        NULLIF(TRIM(s.address_city),''),
        NULLIF(TRIM(s.address_state),''),
        NULLIF(TRIM(s.address_zip),'')
      )),''),'') AS raw_addr,
      s.created_at AS s_created, s.phone AS s_phone
    FROM public.stores s
    LEFT JOIN public.store_master sm ON sm.id = s.id
    WHERE s.deleted_at IS NULL
  ),
  cleaned AS (
    SELECT sid, sname,
      regexp_replace(nname_raw, '\s+', ' ', 'g') AS nname,
      nphone, raw_addr, s_created, s_phone
    FROM base
    WHERE nname_raw <> '' AND length(nphone) >= 10
  ),
  in_addr_group AS (
    SELECT DISTINCT c.store_id AS sid FROM public.dynasty_merge_analysis_cache c
  ),
  filtered AS (
    SELECT cl.* FROM cleaned cl
    WHERE cl.sid NOT IN (SELECT sid FROM in_addr_group)
  ),
  grouped AS (
    SELECT nname, nphone, COUNT(*)::int AS gsize,
      array_agg(sid ORDER BY s_created)        AS ids,
      array_agg(sname ORDER BY s_created)      AS names,
      array_agg(raw_addr ORDER BY s_created)   AS addrs,
      array_agg(s_phone ORDER BY s_created)    AS phones,
      array_agg(s_created ORDER BY s_created)  AS dates
    FROM filtered
    GROUP BY nname, nphone
    HAVING COUNT(*) >= 2
  ),
  numbered AS (
    SELECT ROW_NUMBER() OVER (ORDER BY gsize DESC, nname, nphone)::int AS gid,
      nname, nphone, gsize, ids, names, addrs, phones, dates
    FROM grouped
  ),
  expanded AS (
    SELECT
      n.gid AS phone_name_group_id, n.nname AS norm_name, n.nphone AS norm_phone,
      n.gsize AS group_size, ord.sid AS store_id, ord.sname AS store_name,
      ord.addr AS raw_address, ord.ph AS phone, ord.dt AS created_at,
      (ord.rn = 1) AS is_winner,
      (SELECT COUNT(DISTINCT NULLIF(TRIM(a),''))::int
         FROM unnest(n.addrs) a WHERE NULLIF(TRIM(a),'') IS NOT NULL) AS distinct_addresses,
      (SELECT COUNT(DISTINCT lower(TRIM(nm)))::int
         FROM unnest(n.names) nm) AS distinct_names
    FROM numbered n
    CROSS JOIN LATERAL (
      SELECT u.sid, u.sname, u.addr, u.ph, u.dt,
        ROW_NUMBER() OVER (ORDER BY u.dt) AS rn
      FROM unnest(n.ids, n.names, n.addrs, n.phones, n.dates)
        AS u(sid, sname, addr, ph, dt)
    ) ord
  )
  SELECT e.phone_name_group_id, e.norm_name, e.norm_phone, e.group_size,
    e.store_id, e.store_name, e.raw_address, e.phone, e.created_at, e.is_winner,
    (e.distinct_names > 1 AND e.distinct_addresses >= 2) AS is_owner_cluster_candidate,
    (e.distinct_names > 1 AND e.distinct_addresses >= 2) AS needs_review,
    CASE WHEN e.distinct_names > 1 AND e.distinct_addresses >= 2
      THEN 'R6: Likely owner cluster — same phone, different store names, different addresses'
      ELSE NULL END AS review_reason,
    e.distinct_addresses, e.distinct_names
  FROM expanded e
  ORDER BY e.group_size DESC, e.phone_name_group_id, e.created_at;
END;
$$;
