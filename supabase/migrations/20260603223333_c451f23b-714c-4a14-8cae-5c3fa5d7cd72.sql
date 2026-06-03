
-- STEP 1
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS business_date date;
ALTER TABLE public.invoices DISABLE TRIGGER USER;
UPDATE public.invoices SET business_date = created_at::date WHERE business_date IS NULL;
ALTER TABLE public.invoices ENABLE TRIGGER USER;
ALTER TABLE public.invoices ALTER COLUMN business_date SET NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN business_date SET DEFAULT CURRENT_DATE;
CREATE INDEX IF NOT EXISTS idx_invoices_business_date ON public.invoices (business_date);
CREATE INDEX IF NOT EXISTS idx_invoices_store_business_date ON public.invoices (store_id, business_date);

-- Drop views (cascade reaches dependents we'll rebuild)
DROP VIEW IF EXISTS public.v_neighborhood_tube_intel CASCADE;
DROP VIEW IF EXISTS public.v_reactivation_targets CASCADE;
DROP VIEW IF EXISTS public.v_store_tube_summary CASCADE;
DROP VIEW IF EXISTS public.v_invoice_effective_tubes CASCADE;
DROP VIEW IF EXISTS public.v_tubes_sold_per_store_per_day CASCADE;

CREATE VIEW public.v_invoice_effective_tubes AS
SELECT ili.invoice_id, inv.invoice_number, inv.total,
       inv.business_date AS invoice_date,
       SUM(ili.quantity) AS tube_count,
       'live_line_item'::text AS source,
       NULL::text AS confidence_level
  FROM invoice_line_items ili
  JOIN invoices inv ON inv.id = ili.invoice_id
 WHERE inv.status = 'finalized' AND inv.deleted_at IS NULL
 GROUP BY ili.invoice_id, inv.invoice_number, inv.total, inv.business_date
UNION ALL
SELECT hlr.invoice_id, inv.invoice_number, inv.total,
       inv.business_date AS invoice_date,
       hlr.unit_count AS tube_count,
       CASE WHEN hlr.attribution_method = 'price_map_auto' THEN 'price_map_auto'
            ELSE 'historical_exact_repair' END AS source,
       hlr.confidence_level
  FROM historical_invoice_line_repairs hlr
  JOIN invoices inv ON inv.id = hlr.invoice_id
 WHERE hlr.attribution_method IN ('manual_exact','price_map_auto')
   AND hlr.unit_count IS NOT NULL
   AND inv.status = 'finalized' AND inv.deleted_at IS NULL
   AND NOT (hlr.invoice_id IN (SELECT DISTINCT invoice_id FROM invoice_line_items));

CREATE VIEW public.v_store_tube_summary AS
WITH eff AS (
  SELECT i.store_id, vet.invoice_id, vet.tube_count, vet.total,
         i.business_date AS invoice_date
    FROM v_invoice_effective_tubes vet
    JOIN invoices i ON i.id = vet.invoice_id
   WHERE i.store_id IS NOT NULL AND i.deleted_at IS NULL
),
agg AS (
  SELECT eff.store_id,
         SUM(eff.tube_count) AS lifetime,
         SUM(eff.total) AS lifetime_revenue,
         COUNT(DISTINCT eff.invoice_id)::integer AS invoice_count,
         SUM(eff.tube_count) FILTER (WHERE eff.invoice_date >= (CURRENT_DATE - INTERVAL '30 days')) AS d30,
         SUM(eff.tube_count) FILTER (WHERE eff.invoice_date >= (CURRENT_DATE - INTERVAL '90 days')) AS d90,
         SUM(eff.tube_count) FILTER (WHERE eff.invoice_date >= date_trunc('month', CURRENT_DATE)::date) AS mtd,
         SUM(eff.tube_count) FILTER (WHERE eff.invoice_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date
                                        AND eff.invoice_date <  date_trunc('month', CURRENT_DATE)::date) AS prior_month,
         MAX(eff.invoice_date) AS last_tx
    FROM eff GROUP BY eff.store_id
),
on_hand AS (
  SELECT sti.store_id, SUM(sti.current_tubes_left)::numeric AS total_on_hand
    FROM store_tube_inventory sti
   WHERE sti.brand <> 'hotscolatti'
   GROUP BY sti.store_id
),
top_brand AS (
  SELECT DISTINCT ON (x.store_id) x.store_id, x.brand
    FROM (SELECT i.store_id, ili.brand, SUM(ili.quantity) AS s
            FROM invoice_line_items ili
            JOIN invoices i ON i.id = ili.invoice_id
           WHERE ili.brand IS NOT NULL AND i.store_id IS NOT NULL
             AND i.deleted_at IS NULL AND i.status = 'finalized'
           GROUP BY i.store_id, ili.brand) x
   ORDER BY x.store_id, x.s DESC
)
SELECT s.id AS store_id, s.name AS store_name, s.neighborhood, s.boro, s.address_zip,
       s.status, s.assigned_ambassador_id,
       COALESCE(a.lifetime, 0) AS lifetime_tubes_sold,
       COALESCE(a.lifetime, 0) AS lifetime_tubes_delivered,
       COALESCE(a.lifetime_revenue, 0) AS lifetime_invoice_revenue,
       COALESCE(a.invoice_count, 0) AS invoice_count,
       COALESCE(oh.total_on_hand, 0) AS current_inventory_count,
       COALESCE(a.d30, 0) AS tubes_last_30_days,
       COALESCE(a.mtd, 0) AS tubes_this_month,
       COALESCE(a.d90, 0) AS tubes_last_90_days,
       tb.brand AS top_brand,
       CASE WHEN COALESCE(oh.total_on_hand,0) = 0 THEN 'out_of_stock'
            WHEN oh.total_on_hand < 50 THEN 'restock_now'
            WHEN oh.total_on_hand < 200 THEN 'restock_soon'
            ELSE 'stocked' END AS restock_status,
       a.last_tx AS last_tube_transaction_at,
       COALESCE(a.prior_month, 0) AS tubes_prior_month,
       CASE WHEN COALESCE(a.prior_month,0) = 0 THEN NULL
            ELSE round(((COALESCE(a.mtd,0) - a.prior_month) / a.prior_month) * 100, 1) END AS tubes_mom_delta_pct
  FROM stores s
  LEFT JOIN agg a       ON a.store_id  = s.id
  LEFT JOIN on_hand oh  ON oh.store_id = s.id
  LEFT JOIN top_brand tb ON tb.store_id = s.id
 WHERE s.deleted_at IS NULL AND (s.is_test_data = false OR s.is_test_data IS NULL);

CREATE VIEW public.v_tubes_sold_per_store_per_day AS
SELECT tsl.store_id, tsl.brand_id, tsl.brand,
       COALESCE(inv.business_date, tsl.created_at::date) AS sale_date,
       SUM(CASE WHEN tsl.source = 'invoice_finalized' THEN ABS(tsl.tubes_delta) ELSE 0 END) AS tubes_sold,
       SUM(CASE WHEN tsl.source = 'invoice_voided_reversal' THEN tsl.tubes_delta ELSE 0 END) AS tubes_reversed,
       SUM(tsl.tubes_delta) AS net_tubes_delta
  FROM tube_sale_ledger tsl
  LEFT JOIN invoices inv ON inv.id = tsl.invoice_id
 GROUP BY tsl.store_id, tsl.brand_id, tsl.brand, COALESCE(inv.business_date, tsl.created_at::date);

-- Recreate dependent views verbatim
CREATE VIEW public.v_neighborhood_tube_intel AS
WITH base AS (
  SELECT s.id AS store_id, s.name,
         COALESCE(s.neighborhood, '(unknown)') AS neighborhood,
         COALESCE(s.boro, '(unknown)') AS boro,
         s.status::text AS status,
         COALESCE(k.lifetime_tubes_delivered, 0::numeric) AS lifetime_tubes,
         COALESCE(k.top_brand, '') AS top_brand,
         COALESCE(k.tubes_last_90_days, 0::numeric) AS tubes_90d,
         CASE WHEN s.reactivated_at IS NULL AND COALESCE(k.lifetime_tubes_delivered,0::numeric) > 0 AND s.status::text <> 'test' THEN 1 ELSE 0 END AS is_reactivation_target,
         CASE WHEN s.status::text = 'active' AND s.reactivated_at IS NOT NULL THEN 1 ELSE 0 END AS revenue_active,
         CASE WHEN s.status::text = 'prospect' THEN 1 ELSE 0 END AS is_prospect,
         CASE WHEN s.status::text = 'lost' THEN 1 ELSE 0 END AS is_lost
    FROM stores s
    LEFT JOIN v_store_tube_summary k ON k.store_id = s.id
   WHERE s.deleted_at IS NULL AND COALESCE(s.is_test_data, false) = false
),
agg AS (
  SELECT neighborhood, boro,
         sum(lifetime_tubes) AS total_lifetime_tubes,
         sum(revenue_active) AS revenue_active_count,
         sum(is_reactivation_target) AS reactivation_target_count,
         sum(CASE WHEN is_reactivation_target = 1 THEN lifetime_tubes ELSE 0::numeric END) AS reactivation_target_tube_value,
         sum(is_prospect) AS prospect_count,
         sum(is_lost) AS lost_count,
         count(*) AS total_known_stores,
         sum(tubes_90d) AS tubes_90d_total
    FROM base GROUP BY neighborhood, boro
),
brand AS (
  SELECT neighborhood, boro, top_brand,
         row_number() OVER (PARTITION BY neighborhood, boro ORDER BY sum(lifetime_tubes) DESC) AS rn
    FROM base WHERE top_brand <> ''
   GROUP BY neighborhood, boro, top_brand
),
top5 AS (
  SELECT x.neighborhood, x.boro,
         jsonb_agg(jsonb_build_object('name', x.name, 'tubes', x.lifetime_tubes, 'status', x.status) ORDER BY x.lifetime_tubes DESC) FILTER (WHERE x.rn <= 5) AS top_5_stores
    FROM (SELECT neighborhood, boro, name, lifetime_tubes, status,
                 row_number() OVER (PARTITION BY neighborhood, boro ORDER BY lifetime_tubes DESC) AS rn
            FROM base) x
   GROUP BY x.neighborhood, x.boro
)
SELECT a.neighborhood, a.boro, a.total_lifetime_tubes, a.revenue_active_count, a.reactivation_target_count,
       a.reactivation_target_tube_value, a.prospect_count, a.lost_count, a.total_known_stores,
       round((100.0 * a.revenue_active_count::numeric) / NULLIF(a.total_known_stores,0)::numeric, 1) AS takeover_pct,
       b.top_brand,
       round(a.tubes_90d_total / 3.0, 1) AS monthly_velocity,
       round(a.total_lifetime_tubes / 4.0, 0) AS estimated_customers,
       t.top_5_stores
  FROM agg a
  LEFT JOIN brand b ON b.neighborhood = a.neighborhood AND b.boro = a.boro AND b.rn = 1
  LEFT JOIN top5 t  ON t.neighborhood = a.neighborhood AND t.boro = a.boro;

CREATE VIEW public.v_reactivation_targets AS
SELECT s.id AS store_id, s.name AS store_name,
       s.address_street AS address_line_1, s.boro, s.neighborhood,
       s.address_zip, s.address_city, s.address_state,
       s.phone, s.email, s.assigned_ambassador_id,
       s.reactivation_priority, s.reactivation_attempts,
       s.last_reactivation_attempt_at, s.activated_at,
       COALESCE(t.lifetime_tubes_delivered, 0::numeric) AS lifetime_tubes_delivered,
       t.top_brand, t.last_tube_transaction_at,
       CASE WHEN t.last_tube_transaction_at IS NOT NULL
            THEN EXTRACT(day FROM (now() - t.last_tube_transaction_at::timestamptz))::integer
            ELSE NULL END AS days_since_last_delivery,
       round(COALESCE(t.lifetime_tubes_delivered, 0::numeric) *
         CASE s.reactivation_priority
           WHEN 'easy_reorder' THEN 1.50
           WHEN 'warm_restart' THEN 1.25
           WHEN 'cold_restart' THEN 1.00
           ELSE 0.75 END, 2) AS reactivation_score
  FROM stores s
  LEFT JOIN v_store_tube_summary t ON t.store_id = s.id
 WHERE s.status::text = 'reactivation_target' AND s.deleted_at IS NULL AND (s.is_test_data = false OR s.is_test_data IS NULL);

-- STEP 2
ALTER TABLE public.store_notes ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.store_master ADD COLUMN IF NOT EXISTS is_historical boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_store_master_is_historical ON public.store_master (is_historical) WHERE is_historical = true;

-- STEP 3: staging
CREATE TABLE IF NOT EXISTS public.import_stores_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id uuid NOT NULL, source_row_num integer, source_file text,
  raw_payload jsonb NOT NULL, match_status text NOT NULL DEFAULT 'pending',
  matched_id uuid, candidate_ids uuid[] DEFAULT '{}',
  reviewer_id uuid, reviewer_decision text, reviewer_decision_at timestamptz,
  error text, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_stores_staging TO authenticated;
GRANT ALL ON public.import_stores_staging TO service_role;
ALTER TABLE public.import_stores_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage iss" ON public.import_stores_staging FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_iss_batch ON public.import_stores_staging (import_batch_id);
CREATE INDEX IF NOT EXISTS idx_iss_status ON public.import_stores_staging (match_status);

CREATE TABLE IF NOT EXISTS public.import_invoices_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id uuid NOT NULL, source_row_num integer, source_file text,
  raw_payload jsonb NOT NULL, match_status text NOT NULL DEFAULT 'pending',
  matched_id uuid, candidate_ids uuid[] DEFAULT '{}', composite_hash text,
  reviewer_id uuid, reviewer_decision text, reviewer_decision_at timestamptz,
  error text, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_invoices_staging TO authenticated;
GRANT ALL ON public.import_invoices_staging TO service_role;
ALTER TABLE public.import_invoices_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage iis" ON public.import_invoices_staging FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_iis_batch ON public.import_invoices_staging (import_batch_id);
CREATE INDEX IF NOT EXISTS idx_iis_status ON public.import_invoices_staging (match_status);
CREATE INDEX IF NOT EXISTS idx_iis_hash ON public.import_invoices_staging (composite_hash);

CREATE TABLE IF NOT EXISTS public.import_contacts_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id uuid NOT NULL, source_row_num integer, source_file text,
  raw_payload jsonb NOT NULL, match_status text NOT NULL DEFAULT 'pending',
  matched_id uuid, candidate_ids uuid[] DEFAULT '{}',
  reviewer_id uuid, reviewer_decision text, reviewer_decision_at timestamptz,
  error text, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_contacts_staging TO authenticated;
GRANT ALL ON public.import_contacts_staging TO service_role;
ALTER TABLE public.import_contacts_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage ics" ON public.import_contacts_staging FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_ics_batch ON public.import_contacts_staging (import_batch_id);

CREATE TABLE IF NOT EXISTS public.import_notes_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id uuid NOT NULL, source_row_num integer, source_file text,
  raw_payload jsonb NOT NULL, match_status text NOT NULL DEFAULT 'pending',
  matched_id uuid, candidate_ids uuid[] DEFAULT '{}',
  reviewer_id uuid, reviewer_decision text, reviewer_decision_at timestamptz,
  error text, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_notes_staging TO authenticated;
GRANT ALL ON public.import_notes_staging TO service_role;
ALTER TABLE public.import_notes_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage ins" ON public.import_notes_staging FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_ins_batch ON public.import_notes_staging (import_batch_id);

-- STEP 4 helpers + match RPCs
CREATE OR REPLACE FUNCTION public._norm_phone(p text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT NULLIF(regexp_replace(COALESCE(p,''), '[^0-9]', '', 'g'), '');
$$;

CREATE OR REPLACE FUNCTION public._norm_text(p text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT lower(regexp_replace(COALESCE(p,''), '\s+', ' ', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.match_import_stores(_batch_id uuid)
RETURNS TABLE(stage_id uuid, match_status text, matched_id uuid, candidate_ids uuid[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH staged AS (
    SELECT s.id,
           _norm_phone(s.raw_payload->>'phone') AS p,
           _norm_text(s.raw_payload->>'name')   AS n,
           _norm_text(s.raw_payload->>'address')AS a,
           _norm_text(s.raw_payload->>'city')   AS c
      FROM import_stores_staging s
     WHERE s.import_batch_id = _batch_id
  ),
  phone_match AS (
    SELECT st.id AS sgid, array_agg(DISTINCT sm.id) AS ids
      FROM staged st JOIN store_master sm ON _norm_phone(sm.phone) = st.p AND st.p IS NOT NULL
     GROUP BY st.id
  ),
  addr_match AS (
    SELECT st.id AS sgid, array_agg(DISTINCT sm.id) AS ids
      FROM staged st JOIN store_master sm
        ON st.a IS NOT NULL AND length(st.a) > 4
       AND _norm_text(sm.address) = st.a
       AND (st.c IS NULL OR _norm_text(sm.city) = st.c)
     WHERE st.id NOT IN (SELECT sgid FROM phone_match)
     GROUP BY st.id
  ),
  name_match AS (
    SELECT st.id AS sgid, array_agg(DISTINCT sm.id) AS ids
      FROM staged st JOIN store_master sm
        ON st.n IS NOT NULL AND length(st.n) > 2
       AND _norm_text(sm.store_name) = st.n
       AND (st.c IS NULL OR _norm_text(sm.city) = st.c)
     WHERE st.id NOT IN (SELECT sgid FROM phone_match)
       AND st.id NOT IN (SELECT sgid FROM addr_match)
     GROUP BY st.id
  ),
  all_matches AS (
    SELECT sgid, ids FROM phone_match
    UNION ALL SELECT sgid, ids FROM addr_match
    UNION ALL SELECT sgid, ids FROM name_match
  )
  SELECT st.id,
         CASE WHEN am.ids IS NULL THEN 'none'
              WHEN array_length(am.ids,1) = 1 THEN 'exact'
              ELSE 'ambiguous' END,
         CASE WHEN array_length(am.ids,1) = 1 THEN am.ids[1] ELSE NULL END,
         COALESCE(am.ids, '{}'::uuid[])
    FROM staged st LEFT JOIN all_matches am ON am.sgid = st.id;
END $$;
GRANT EXECUTE ON FUNCTION public.match_import_stores(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.match_import_invoices(_batch_id uuid)
RETURNS TABLE(stage_id uuid, match_status text, matched_id uuid, composite_hash text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  RETURN QUERY
  WITH staged AS (
    SELECT s.id,
           NULLIF(s.raw_payload->>'store_id','')::uuid AS sid,
           NULLIF(s.raw_payload->>'business_date','')::date AS bdate,
           NULLIF(s.raw_payload->>'total_amount','')::numeric AS tot,
           COALESCE(s.raw_payload->>'line_hashes','') AS line_hashes
      FROM import_invoices_staging s
     WHERE s.import_batch_id = _batch_id
  ),
  hashed AS (
    SELECT id,
           encode(extensions.digest(coalesce(sid::text,'')||'|'||coalesce(bdate::text,'')||'|'||coalesce(tot::text,'')||'|'||line_hashes, 'sha256'),'hex') AS h
      FROM staged
  ),
  existing AS (
    SELECT i.id,
           encode(extensions.digest(
             coalesce(i.store_id::text,'')||'|'||coalesce(i.business_date::text,'')||'|'||coalesce(i.total_amount::text,'')||'|'||
             COALESCE((SELECT string_agg(md5(coalesce(li.product_id::text,'')||':'||coalesce(li.quantity::text,'')||':'||coalesce(li.unit_price::text,'')), ',' ORDER BY md5(coalesce(li.product_id::text,'')||':'||coalesce(li.quantity::text,'')||':'||coalesce(li.unit_price::text,'')))
                        FROM invoice_line_items li WHERE li.invoice_id = i.id),''),
             'sha256'),'hex') AS h
      FROM invoices i WHERE i.deleted_at IS NULL
  )
  SELECT h.id,
         CASE WHEN e.id IS NULL THEN 'none' ELSE 'exact' END,
         e.id, h.h
    FROM hashed h LEFT JOIN existing e ON e.h = h.h;
END $$;
GRANT EXECUTE ON FUNCTION public.match_import_invoices(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.match_import_contacts(_batch_id uuid)
RETURNS TABLE(stage_id uuid, match_status text, matched_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH staged AS (
    SELECT s.id,
           NULLIF(s.raw_payload->>'store_id','')::uuid AS sid,
           _norm_phone(s.raw_payload->>'phone') AS p
      FROM import_contacts_staging s
     WHERE s.import_batch_id = _batch_id
  ),
  matches AS (
    SELECT st.id AS sgid, c.id AS cid
      FROM staged st
      JOIN contacts c ON c.store_id = st.sid AND _norm_phone(c.phone) = st.p AND st.p IS NOT NULL
  )
  SELECT st.id,
         CASE WHEN m.cid IS NULL THEN 'none' ELSE 'exact' END,
         m.cid
    FROM staged st LEFT JOIN matches m ON m.sgid = st.id;
END $$;
GRANT EXECUTE ON FUNCTION public.match_import_contacts(uuid) TO authenticated, service_role;

-- STEP 5: commit RPC (batches ≤100, per-row try/catch, logs to historical_invoice_repairs)
CREATE OR REPLACE FUNCTION public.commit_import_batch(_batch_id uuid, _committed_by uuid DEFAULT NULL)
RETURNS TABLE(stage_id uuid, kind text, status text, inserted_id uuid, error text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _rec record;
  _max_batch int := 100;
  _new_id uuid;
  _bdate date;
  _src text;
BEGIN
  _src := 'historical_import_2026_' || substr(_batch_id::text, 1, 8);

  FOR _rec IN
    SELECT * FROM import_invoices_staging
     WHERE import_batch_id = _batch_id
       AND match_status <> 'committed'
       AND COALESCE(reviewer_decision,'') <> 'skip'
       AND (match_status <> 'exact' OR reviewer_decision = 'create_new')
     ORDER BY created_at LIMIT _max_batch
  LOOP
    BEGIN
      _bdate := NULLIF(_rec.raw_payload->>'business_date','')::date;
      IF _bdate IS NULL THEN RAISE EXCEPTION 'business_date required'; END IF;

      INSERT INTO invoices (
        store_id, invoice_number, total_amount, total, subtotal,
        business_date, created_at, status, is_historical,
        notes, payment_status, customer_type
      ) VALUES (
        NULLIF(_rec.raw_payload->>'store_id','')::uuid,
        COALESCE(_rec.raw_payload->>'invoice_number', 'HIST-'||substr(_rec.id::text,1,8)),
        NULLIF(_rec.raw_payload->>'total_amount','')::numeric,
        NULLIF(_rec.raw_payload->>'total_amount','')::numeric,
        COALESCE(NULLIF(_rec.raw_payload->>'subtotal','')::numeric, NULLIF(_rec.raw_payload->>'total_amount','')::numeric),
        _bdate, _bdate::timestamptz, 'finalized', true,
        COALESCE(_rec.raw_payload->>'notes','') || ' [src:' || _src || ']',
        COALESCE(_rec.raw_payload->>'payment_status','paid'), 'store'
      ) RETURNING id INTO _new_id;

      INSERT INTO historical_invoice_repairs (invoice_id, repair_type, notes, created_at)
      VALUES (_new_id, 'historical_import', 'batch=' || _batch_id::text || ' stage=' || _rec.id::text, now());

      UPDATE import_invoices_staging SET match_status='committed', matched_id=_new_id WHERE id=_rec.id;
      stage_id := _rec.id; kind := 'invoice'; status := 'ok'; inserted_id := _new_id; error := NULL;
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      UPDATE import_invoices_staging SET match_status='failed', error=SQLERRM WHERE id=_rec.id;
      stage_id := _rec.id; kind := 'invoice'; status := 'fail'; inserted_id := NULL; error := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;

  FOR _rec IN
    SELECT * FROM import_notes_staging
     WHERE import_batch_id = _batch_id AND match_status <> 'committed'
       AND COALESCE(reviewer_decision,'') <> 'skip'
     ORDER BY created_at LIMIT _max_batch
  LOOP
    BEGIN
      INSERT INTO store_notes (store_id, note, source, created_at)
      VALUES (
        NULLIF(_rec.raw_payload->>'store_id','')::uuid,
        _rec.raw_payload->>'note', _src,
        COALESCE(NULLIF(_rec.raw_payload->>'created_at','')::timestamptz, now())
      ) RETURNING id INTO _new_id;
      UPDATE import_notes_staging SET match_status='committed', matched_id=_new_id WHERE id=_rec.id;
      stage_id := _rec.id; kind := 'note'; status := 'ok'; inserted_id := _new_id; error := NULL;
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      UPDATE import_notes_staging SET match_status='failed', error=SQLERRM WHERE id=_rec.id;
      stage_id := _rec.id; kind := 'note'; status := 'fail'; inserted_id := NULL; error := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.commit_import_batch(uuid, uuid) TO authenticated, service_role;
