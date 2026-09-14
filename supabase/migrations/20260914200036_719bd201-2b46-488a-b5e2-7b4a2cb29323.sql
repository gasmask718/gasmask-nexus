-- 1. Normalisation helpers (IMMUTABLE so they can back generated columns)
CREATE OR REPLACE FUNCTION public.bl_norm_name(_t text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT nullif(
    btrim(regexp_replace(
      regexp_replace(
        regexp_replace(lower(coalesce(_t,'')), '[^a-z0-9 ]', ' ', 'g'),
        '\y(llc|l l c|inc|incorporated|corp|corporation|co|ltd|limited|the|and)\y', ' ', 'g'),
      '\s+', ' ', 'g')),
  '');
$$;

CREATE OR REPLACE FUNCTION public.bl_norm_addr(_t text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT nullif(
    btrim(regexp_replace(
      regexp_replace(
        regexp_replace(lower(coalesce(_t,'')), '[^a-z0-9 ]', ' ', 'g'),
        '\y(street|st|avenue|ave|road|rd|boulevard|blvd|suite|ste|drive|dr|lane|ln|unit|apt|floor|fl)\y', ' ', 'g'),
      '\s+', ' ', 'g')),
  '');
$$;

CREATE OR REPLACE FUNCTION public.bl_domain(_url text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT nullif(
    regexp_replace(
      regexp_replace(
        split_part(regexp_replace(lower(btrim(coalesce(_url,''))), '^https?://', ''), '/', 1),
      '^www\.', ''),
    ':\d+$', ''),
  '');
$$;

-- 2. Canonical columns missing from business_leads (all nullable, no behaviour change)
ALTER TABLE public.business_leads
  ADD COLUMN IF NOT EXISTS street_address text,
  ADD COLUMN IF NOT EXISTS zip text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_record_id text,
  ADD COLUMN IF NOT EXISTS ingestion_run_id uuid,
  ADD COLUMN IF NOT EXISTS name_norm text GENERATED ALWAYS AS (public.bl_norm_name(business_name)) STORED,
  ADD COLUMN IF NOT EXISTS addr_norm text GENERATED ALWAYS AS (public.bl_norm_addr(coalesce(street_address, full_address))) STORED,
  ADD COLUMN IF NOT EXISTS website_domain text GENERATED ALWAYS AS (public.bl_domain(website)) STORED;

-- 3. Canonical identity for the SHARED pool only (existing per-brand rows untouched)
CREATE UNIQUE INDEX IF NOT EXISTS business_leads_shared_phone_uniq
  ON public.business_leads (phone_last10)
  WHERE business = 'shared' AND duplicate_of IS NULL AND phone_last10 IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS business_leads_shared_domain_uniq
  ON public.business_leads (website_domain)
  WHERE business = 'shared' AND duplicate_of IS NULL AND website_domain IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS business_leads_shared_name_addr_uniq
  ON public.business_leads (name_norm, addr_norm)
  WHERE business = 'shared' AND duplicate_of IS NULL AND name_norm IS NOT NULL AND addr_norm IS NOT NULL;

CREATE INDEX IF NOT EXISTS business_leads_source_record_idx
  ON public.business_leads (external_source, source_record_id)
  WHERE source_record_id IS NOT NULL;

-- 4. Ingestion runs (smallest reusable provenance structure)
CREATE TABLE IF NOT EXISTS public.lead_ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  query_term text,
  geography text,
  category text,
  companies text[] NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  outcome text NOT NULL DEFAULT 'running',
  raw_result_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  deduped_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  error_detail text,
  created_by uuid,
  notes text
);
GRANT SELECT ON public.lead_ingestion_runs TO authenticated;
GRANT ALL ON public.lead_ingestion_runs TO service_role;
ALTER TABLE public.lead_ingestion_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lead_ingestion_runs_admin_read ON public.lead_ingestion_runs;
CREATE POLICY lead_ingestion_runs_admin_read ON public.lead_ingestion_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

-- 5. Company eligibility (one business, many companies — never duplicated)
CREATE TABLE IF NOT EXISTS public.business_lead_eligibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.business_leads(id) ON DELETE CASCADE,
  company text NOT NULL,
  eligible boolean NOT NULL DEFAULT true,
  reason text,
  rule text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, company)
);
CREATE INDEX IF NOT EXISTS business_lead_eligibility_company_idx
  ON public.business_lead_eligibility (company) WHERE eligible;
GRANT SELECT ON public.business_lead_eligibility TO authenticated;
GRANT ALL ON public.business_lead_eligibility TO service_role;
ALTER TABLE public.business_lead_eligibility ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS business_lead_eligibility_admin_read ON public.business_lead_eligibility;
CREATE POLICY business_lead_eligibility_admin_read ON public.business_lead_eligibility
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

-- 6. Rule-driven eligibility recompute for one canonical lead
CREATE OR REPLACE FUNCTION public.apply_business_lead_eligibility(_lead_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  SELECT id, website_domain INTO r FROM business_leads WHERE id = _lead_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Brandaro rule: eligible only when the business has no website
  IF r.website_domain IS NULL THEN
    INSERT INTO business_lead_eligibility (lead_id, company, eligible, reason, rule)
    VALUES (_lead_id, 'brandaro', true, 'no_website', 'brandaro.no_website')
    ON CONFLICT (lead_id, company) DO UPDATE
      SET eligible = true, reason = 'no_website', rule = 'brandaro.no_website', updated_at = now();
  ELSE
    UPDATE business_lead_eligibility
      SET eligible = false, reason = 'has_website', updated_at = now()
      WHERE lead_id = _lead_id AND company = 'brandaro' AND rule = 'brandaro.no_website';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.apply_business_lead_eligibility(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_business_lead_eligibility(uuid) TO service_role;

-- 7. Canonical shared ingest: search once -> normalize -> dedupe -> one row -> eligibility
CREATE OR REPLACE FUNCTION public.ingest_business_lead(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text := nullif(btrim(p->>'business_name'),'');
  v_phone text := nullif(btrim(p->>'phone'),'');
  v_last10 text;
  v_domain text := bl_domain(p->>'website');
  v_name_norm text := bl_norm_name(v_name);
  v_addr_norm text := bl_norm_addr(coalesce(p->>'street_address', p->>'full_address'));
  v_src text := coalesce(nullif(p->>'source',''),'manual');
  v_src_id text := nullif(coalesce(p->>'source_record_id', p->>'external_place_id'),'');
  v_id uuid; v_action text; v_matched text; c text;
BEGIN
  IF v_name IS NULL THEN RAISE EXCEPTION 'ingest_business_lead: business_name required'; END IF;

  v_last10 := CASE WHEN length(regexp_replace(coalesce(v_phone,''),'[^0-9]','','g')) >= 10
                   THEN right(regexp_replace(v_phone,'[^0-9]','','g'),10) END;

  -- dedupe: strongest identifier first
  IF v_src_id IS NOT NULL THEN
    SELECT id INTO v_id FROM business_leads
     WHERE business='shared' AND duplicate_of IS NULL
       AND external_source = v_src AND source_record_id = v_src_id LIMIT 1;
    IF v_id IS NOT NULL THEN v_matched := 'source_record_id'; END IF;
  END IF;
  IF v_id IS NULL AND v_last10 IS NOT NULL THEN
    SELECT id INTO v_id FROM business_leads
     WHERE business='shared' AND duplicate_of IS NULL AND phone_last10 = v_last10 LIMIT 1;
    IF v_id IS NOT NULL THEN v_matched := 'phone'; END IF;
  END IF;
  IF v_id IS NULL AND v_domain IS NOT NULL THEN
    SELECT id INTO v_id FROM business_leads
     WHERE business='shared' AND duplicate_of IS NULL AND website_domain = v_domain LIMIT 1;
    IF v_id IS NOT NULL THEN v_matched := 'website_domain'; END IF;
  END IF;
  IF v_id IS NULL AND v_name_norm IS NOT NULL AND v_addr_norm IS NOT NULL THEN
    SELECT id INTO v_id FROM business_leads
     WHERE business='shared' AND duplicate_of IS NULL
       AND name_norm = v_name_norm AND addr_norm = v_addr_norm LIMIT 1;
    IF v_id IS NOT NULL THEN v_matched := 'name_address'; END IF;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO business_leads (
      business, business_name, category, phone, email, website,
      street_address, full_address, city, state, zip, country,
      latitude, longitude, source, external_source, external_place_id,
      source_record_id, source_url, metro, google_types, maps_url,
      ingestion_run_id, status, ai_call_eligible
    ) VALUES (
      'shared', v_name, coalesce(nullif(p->>'category',''),'other'), v_phone,
      nullif(p->>'email',''), nullif(p->>'website',''),
      nullif(p->>'street_address',''), nullif(p->>'full_address',''),
      nullif(p->>'city',''), nullif(upper(left(p->>'state',2)),''),
      nullif(p->>'zip',''), coalesce(nullif(p->>'country',''),'US'),
      (p->>'latitude')::numeric, (p->>'longitude')::numeric,
      v_src, coalesce(nullif(p->>'external_source',''), v_src),
      nullif(p->>'external_place_id',''), v_src_id, nullif(p->>'source_url',''),
      nullif(p->>'metro',''),
      CASE WHEN p ? 'google_types' THEN ARRAY(SELECT jsonb_array_elements_text(p->'google_types')) END,
      nullif(p->>'maps_url',''),
      nullif(p->>'ingestion_run_id','')::uuid, 'new', v_phone IS NOT NULL
    ) RETURNING id INTO v_id;
    v_action := 'inserted';
  ELSE
    UPDATE business_leads SET
      phone           = coalesce(phone, v_phone),
      email           = coalesce(email, nullif(p->>'email','')),
      website         = coalesce(website, nullif(p->>'website','')),
      street_address  = coalesce(street_address, nullif(p->>'street_address','')),
      full_address    = coalesce(full_address, nullif(p->>'full_address','')),
      city            = coalesce(city, nullif(p->>'city','')),
      state           = coalesce(state, nullif(upper(left(p->>'state',2)),'')),
      zip             = coalesce(zip, nullif(p->>'zip','')),
      country         = coalesce(country, nullif(p->>'country',''),'US'),
      latitude        = coalesce(latitude, (p->>'latitude')::numeric),
      longitude       = coalesce(longitude, (p->>'longitude')::numeric),
      source_url      = coalesce(source_url, nullif(p->>'source_url','')),
      source_record_id= coalesce(source_record_id, v_src_id),
      external_place_id = coalesce(external_place_id, nullif(p->>'external_place_id','')),
      metro           = coalesce(metro, nullif(p->>'metro','')),
      maps_url        = coalesce(maps_url, nullif(p->>'maps_url','')),
      ingestion_run_id= coalesce(nullif(p->>'ingestion_run_id','')::uuid, ingestion_run_id),
      ai_call_eligible= coalesce(phone, v_phone) IS NOT NULL,
      times_seen      = coalesce(times_seen,0) + 1,
      updated_at      = now()
    WHERE id = v_id;
    v_action := 'deduped';
  END IF;

  -- explicit company eligibility from the caller (does not duplicate the business)
  IF p ? 'companies' THEN
    FOR c IN SELECT jsonb_array_elements_text(p->'companies') LOOP
      INSERT INTO business_lead_eligibility (lead_id, company, eligible, reason, rule)
      VALUES (v_id, c, true, coalesce(nullif(p->>'eligibility_reason',''),'explicit'), 'explicit')
      ON CONFLICT (lead_id, company) DO UPDATE SET eligible = true, updated_at = now();
    END LOOP;
  END IF;

  PERFORM apply_business_lead_eligibility(v_id);

  RETURN jsonb_build_object('lead_id', v_id, 'action', v_action, 'matched_on', v_matched);
END $$;
REVOKE ALL ON FUNCTION public.ingest_business_lead(jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_business_lead(jsonb) TO service_role;

-- 8. Company queues (same canonical row, suppression anti-joined)
CREATE OR REPLACE VIEW public.v_services_io_business_leads AS
SELECT l.*, e.reason AS eligibility_reason, e.rule AS eligibility_rule
FROM public.business_leads l
JOIN public.business_lead_eligibility e ON e.lead_id = l.id AND e.company = 'services_io' AND e.eligible
WHERE l.duplicate_of IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.dnc_list d WHERE d.phone_last10 = l.phone_last10)
  AND NOT EXISTS (SELECT 1 FROM public.opt_out_events o WHERE o.phone_last10 = l.phone_last10);

CREATE OR REPLACE VIEW public.v_goddess_in_you_business_leads AS
SELECT l.*, e.reason AS eligibility_reason, e.rule AS eligibility_rule
FROM public.business_leads l
JOIN public.business_lead_eligibility e ON e.lead_id = l.id AND e.company = 'goddess_in_you' AND e.eligible
WHERE l.duplicate_of IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.dnc_list d WHERE d.phone_last10 = l.phone_last10)
  AND NOT EXISTS (SELECT 1 FROM public.opt_out_events o WHERE o.phone_last10 = l.phone_last10);

CREATE OR REPLACE VIEW public.v_brandaro_business_leads AS
SELECT l.*, e.reason AS eligibility_reason, e.rule AS eligibility_rule
FROM public.business_leads l
JOIN public.business_lead_eligibility e ON e.lead_id = l.id AND e.company = 'brandaro' AND e.eligible
WHERE l.duplicate_of IS NULL
  AND l.website_domain IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.dnc_list d WHERE d.phone_last10 = l.phone_last10)
  AND NOT EXISTS (SELECT 1 FROM public.opt_out_events o WHERE o.phone_last10 = l.phone_last10);

GRANT SELECT ON public.v_services_io_business_leads TO authenticated;
GRANT SELECT ON public.v_goddess_in_you_business_leads TO authenticated;
GRANT SELECT ON public.v_brandaro_business_leads TO authenticated;