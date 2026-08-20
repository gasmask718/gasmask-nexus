
-- 1. Rename. FKs, indexes, policies and dependent views follow the table.
ALTER TABLE public.ut_partner_leads RENAME TO business_leads;

-- 2. business column: added nullable, backfilled, then made mandatory with NO default.
ALTER TABLE public.business_leads ADD COLUMN business text;
UPDATE public.business_leads SET business = 'ut' WHERE business IS NULL;
ALTER TABLE public.business_leads ALTER COLUMN business SET NOT NULL;
ALTER TABLE public.business_leads
  ADD CONSTRAINT business_leads_business_known
  CHECK (business IN ('ut','toptier','dynasty','brandaro','gasmask','surplus'));

COMMENT ON COLUMN public.business_leads.business IS
  'Owning business. MANDATORY, no default — a lead that lands with no business is a lead nobody will find. Same rule as the SMS class.';

-- Suppression join key (last-10), matching dnc_list.phone_last10 / opt_out_events.phone_last10.
ALTER TABLE public.business_leads
  ADD COLUMN phone_last10 text
  GENERATED ALWAYS AS (
    CASE WHEN length(regexp_replace(coalesce(phone,''),'[^0-9]','','g')) >= 10
         THEN right(regexp_replace(phone,'[^0-9]','','g'),10) END
  ) STORED;
CREATE INDEX IF NOT EXISTS business_leads_phone_last10_idx ON public.business_leads (phone_last10);
CREATE INDEX IF NOT EXISTS business_leads_business_idx ON public.business_leads (business);

-- 3. Dedupe key: one place_id PER BUSINESS. A place already held by one business
-- becomes a SECOND row under another, deliberately — not a rejected duplicate.
DROP INDEX IF EXISTS public.ut_partner_leads_place_id_unique;
CREATE UNIQUE INDEX business_leads_place_id_business_unique
  ON public.business_leads (external_place_id, business)
  WHERE duplicate_of IS NULL AND external_place_id IS NOT NULL;

-- 4. Category vocabulary: existing UT set + TopTier taxonomy.
-- Clean Google place_type mappings: night_club->nightclub, beauty_salon/hair_care/
-- nail_salon/spa->beauty, car_rental->exotic_car (needs a name filter; most
-- car_rental results are Hertz/Enterprise).
-- NO clean place type — the runner MUST use a text search and set the category from
-- the query that found it, never from the returned types:
--   limo, chauffeur, party_bus, yacht, security_firm, authenticator, private_chef.
ALTER TABLE public.business_leads DROP CONSTRAINT IF EXISTS ut_partner_leads_category_canonical;
ALTER TABLE public.business_leads
  ADD CONSTRAINT business_leads_category_canonical CHECK (category IN (
    'event_hall','rental_company','caterer','bartender','florist','photographer',
    'videographer','decorator','event_planner','entertainer','dj','photo_booth',
    'lighting','transportation','security','staff','cleaner','other',
    'limo','chauffeur','exotic_car','party_bus','yacht','nightclub',
    'security_firm','authenticator','private_chef','beauty'
  ));

-- 5. category_group backfill. The 43,265 NULLs are not unclassified — they are
-- event halls and rental companies whose rollup was never written.
UPDATE public.business_leads SET category_group = CASE category
    WHEN 'event_hall' THEN 'venue'      WHEN 'nightclub' THEN 'venue'
    WHEN 'rental_company' THEN 'rental'
    WHEN 'caterer' THEN 'food'          WHEN 'bartender' THEN 'food'
    WHEN 'private_chef' THEN 'food'
    WHEN 'florist' THEN 'services'      WHEN 'decorator' THEN 'services'
    WHEN 'event_planner' THEN 'services' WHEN 'photographer' THEN 'services'
    WHEN 'videographer' THEN 'services' WHEN 'authenticator' THEN 'services'
    WHEN 'beauty' THEN 'services'
    WHEN 'entertainer' THEN 'entertainment' WHEN 'dj' THEN 'entertainment'
    WHEN 'photo_booth' THEN 'entertainment' WHEN 'lighting' THEN 'entertainment'
    WHEN 'security' THEN 'support'      WHEN 'security_firm' THEN 'support'
    WHEN 'staff' THEN 'support'         WHEN 'cleaner' THEN 'support'
    WHEN 'transportation' THEN 'transport' WHEN 'limo' THEN 'transport'
    WHEN 'chauffeur' THEN 'transport'   WHEN 'exotic_car' THEN 'transport'
    WHEN 'party_bus' THEN 'transport'   WHEN 'yacht' THEN 'transport'
    ELSE NULL END
  WHERE category_group IS NULL;

-- 6. Compatibility view. Every existing reader AND writer keeps its name.
-- Auto-updatable (single table, no computed cols in the target list), so the
-- 8 write paths keep working; the column default supplies 'ut' on insert and
-- WITH CHECK OPTION stops a write from filing a row under another business.
CREATE VIEW public.ut_partner_leads
  WITH (security_invoker = on) AS
  SELECT id, business_name, contact_name, category, phone, email, city, state,
         source, status, assigned_to, ai_score, ai_score_reasons, notes,
         onboarded_at, created_at, updated_at, follow_up_at, callback_due_at,
         last_contacted_at, last_outcome, outreach_count, owner_verified,
         best_time_to_call, assigned_va, priority_bucket, ai_call_eligible,
         ai_call_last_attempt_at, ai_call_result, ai_handoff_reason,
         recommended_ai_agent, next_step, onboarding_link_sent_at,
         last_sms_template, sms_count, automation_state, external_source,
         external_place_id, website, full_address, google_rating, google_types,
         maps_url, ai_score_post_call, latitude, longitude, geocoded_at,
         geocode_source, metro, review_count, priority_score, category_group,
         category_confidence, category_original, partner_id, duplicate_of,
         duplicate_reason, times_seen, timezone, business
    FROM public.business_leads
   WHERE business = 'ut'
  WITH CASCADED CHECK OPTION;

ALTER VIEW public.ut_partner_leads ALTER COLUMN business SET DEFAULT 'ut';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ut_partner_leads TO authenticated;
GRANT ALL ON public.ut_partner_leads TO service_role;
COMMENT ON VIEW public.ut_partner_leads IS
  'Compatibility view over business_leads WHERE business=''ut''. Writable; inserts default business to ''ut''. New code should read v_ut_supply.';

-- 7. Repoint the 6 dependent views back at the UT-filtered compat view. The rename
-- silently rebound them to the base table, which would have leaked other
-- businesses'' leads into UT surfaces (dc_unified_leads labels them 'unforgettable_times').
DO $rebind$
DECLARE r record;
BEGIN
  FOR r IN SELECT viewname, pg_get_viewdef(('public.'||quote_ident(viewname))::regclass, true) AS def
             FROM pg_views
            WHERE schemaname='public'
              AND viewname IN ('dc_unified_leads','ut_category_demand','ut_city_demand',
                               'ut_territory_intelligence','ut_verified_event_halls',
                               'ut_verified_rental_companies')
  LOOP
    EXECUTE format('CREATE OR REPLACE VIEW public.%I AS %s',
                   r.viewname,
                   regexp_replace(r.def, '\mbusiness_leads\M', 'ut_partner_leads', 'g'));
  END LOOP;
END
$rebind$;

-- 8. One view per business. Each filtered, each granted separately, each
-- suppression-anti-joined so a VA query cannot hand back a suppressed number.
CREATE VIEW public.v_ut_supply WITH (security_invoker = on) AS
  SELECT l.* FROM public.business_leads l
   WHERE l.business = 'ut'
     AND NOT EXISTS (SELECT 1 FROM public.dnc_list d WHERE d.phone_last10 = l.phone_last10)
     AND NOT EXISTS (SELECT 1 FROM public.opt_out_events o WHERE o.phone_last10 = l.phone_last10);

CREATE VIEW public.v_toptier_prospects WITH (security_invoker = on) AS
  SELECT l.* FROM public.business_leads l
   WHERE l.business = 'toptier'
     AND NOT EXISTS (SELECT 1 FROM public.dnc_list d WHERE d.phone_last10 = l.phone_last10)
     AND NOT EXISTS (SELECT 1 FROM public.opt_out_events o WHERE o.phone_last10 = l.phone_last10);

CREATE VIEW public.v_dynasty_prospects WITH (security_invoker = on) AS
  SELECT l.* FROM public.business_leads l
   WHERE l.business = 'dynasty'
     AND NOT EXISTS (SELECT 1 FROM public.dnc_list d WHERE d.phone_last10 = l.phone_last10)
     AND NOT EXISTS (SELECT 1 FROM public.opt_out_events o WHERE o.phone_last10 = l.phone_last10);

GRANT SELECT ON public.v_ut_supply TO authenticated;
GRANT SELECT ON public.v_toptier_prospects TO authenticated;
GRANT SELECT ON public.v_dynasty_prospects TO authenticated;
REVOKE ALL ON public.v_ut_supply, public.v_toptier_prospects, public.v_dynasty_prospects FROM anon;

COMMENT ON VIEW public.v_ut_supply IS 'UT leads, suppressed numbers removed (dnc_list + opt_out_events, last-10 match).';
COMMENT ON VIEW public.v_toptier_prospects IS 'TopTier leads, suppressed numbers removed (dnc_list + opt_out_events, last-10 match).';
COMMENT ON VIEW public.v_dynasty_prospects IS 'Dynasty leads, suppressed numbers removed (dnc_list + opt_out_events, last-10 match).';

-- 9. Upsert takes a mandatory business and conflicts on (place_id, business).
CREATE OR REPLACE FUNCTION public.ut_upsert_partner_lead(p jsonb)
RETURNS TABLE(lead_id uuid, was_insert boolean)
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF coalesce(p->>'external_place_id','') = '' THEN
    RAISE EXCEPTION 'ut_upsert: external_place_id required';
  END IF;
  IF coalesce(p->>'business','') = '' THEN
    RAISE EXCEPTION 'ut_upsert: business required (no default — see business_leads.business)';
  END IF;
  IF length(coalesce(p->>'state','')) <> 2 THEN
    RAISE EXCEPTION 'ut_upsert: unresolvable state for place %', p->>'external_place_id';
  END IF;

  RETURN QUERY
  INSERT INTO business_leads (
    business, external_place_id, business_name, category, phone, website,
    full_address, city, state, google_rating, review_count,
    google_types, maps_url, latitude, longitude, source, external_source,
    status, ai_call_eligible, geocoded_at, geocode_source
  )
  VALUES (
    p->>'business',
    p->>'external_place_id', p->>'business_name', p->>'category',
    p->>'phone', p->>'website', p->>'full_address', p->>'city',
    upper(left(p->>'state', 2)), (p->>'google_rating')::numeric,
    (p->>'review_count')::integer,
    ARRAY(SELECT jsonb_array_elements_text(p->'google_types')),
    p->>'maps_url', (p->>'latitude')::numeric, (p->>'longitude')::numeric,
    coalesce(p->>'source', 'google_places'),
    coalesce(p->>'external_source', p->>'source', 'google_places'),
    coalesce(p->>'status', 'new'),
    (p->>'phone') IS NOT NULL,
    CASE WHEN p->>'latitude' IS NOT NULL THEN now() END,
    CASE WHEN p->>'latitude' IS NOT NULL
         THEN coalesce(p->>'geocode_source', 'places_search') END
  )
  ON CONFLICT (external_place_id, business)
    WHERE duplicate_of IS NULL AND external_place_id IS NOT NULL
  DO UPDATE SET
    phone         = COALESCE(EXCLUDED.phone,         business_leads.phone),
    website       = COALESCE(EXCLUDED.website,       business_leads.website),
    google_rating = COALESCE(EXCLUDED.google_rating, business_leads.google_rating),
    review_count  = COALESCE(EXCLUDED.review_count,  business_leads.review_count),
    latitude      = COALESCE(EXCLUDED.latitude,      business_leads.latitude),
    longitude     = COALESCE(EXCLUDED.longitude,     business_leads.longitude),
    google_types  = COALESCE(EXCLUDED.google_types,  business_leads.google_types),
    maps_url      = COALESCE(EXCLUDED.maps_url,      business_leads.maps_url),
    full_address  = COALESCE(EXCLUDED.full_address,  business_leads.full_address),
    geocoded_at    = CASE WHEN business_leads.latitude IS NULL
                           AND EXCLUDED.latitude IS NOT NULL
                          THEN now() ELSE business_leads.geocoded_at END,
    geocode_source = CASE WHEN business_leads.latitude IS NULL
                           AND EXCLUDED.latitude IS NOT NULL
                          THEN EXCLUDED.geocode_source
                          ELSE business_leads.geocode_source END,
    ai_call_eligible = COALESCE(EXCLUDED.phone, business_leads.phone) IS NOT NULL,
    times_seen    = business_leads.times_seen + 1,
    updated_at    = now()
  RETURNING id, (xmax = 0);
END
$fn$;
