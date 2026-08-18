
CREATE TABLE public.us_state_names (
  name text PRIMARY KEY,
  state text NOT NULL
);
GRANT SELECT ON public.us_state_names TO authenticated;
GRANT ALL ON public.us_state_names TO service_role;
ALTER TABLE public.us_state_names ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usn readable by authenticated" ON public.us_state_names FOR SELECT TO authenticated USING (true);

INSERT INTO public.us_state_names (name, state) VALUES
('ALABAMA','AL'),('ALASKA','AK'),('ARIZONA','AZ'),('ARKANSAS','AR'),('CALIFORNIA','CA'),
('COLORADO','CO'),('CONNECTICUT','CT'),('DELAWARE','DE'),('DISTRICT OF COLUMBIA','DC'),
('WASHINGTON DC','DC'),('FLORIDA','FL'),('GEORGIA','GA'),('HAWAII','HI'),('IDAHO','ID'),
('ILLINOIS','IL'),('INDIANA','IN'),('IOWA','IA'),('KANSAS','KS'),('KENTUCKY','KY'),
('LOUISIANA','LA'),('MAINE','ME'),('MARYLAND','MD'),('MASSACHUSETTS','MA'),('MICHIGAN','MI'),
('MINNESOTA','MN'),('MISSISSIPPI','MS'),('MISSOURI','MO'),('MONTANA','MT'),('NEBRASKA','NE'),
('NEVADA','NV'),('NEW HAMPSHIRE','NH'),('NEW JERSEY','NJ'),('NEW MEXICO','NM'),('NEW YORK','NY'),
('NORTH CAROLINA','NC'),('NORTH DAKOTA','ND'),('OHIO','OH'),('OKLAHOMA','OK'),('OREGON','OR'),
('PENNSYLVANIA','PA'),('RHODE ISLAND','RI'),('SOUTH CAROLINA','SC'),('SOUTH DAKOTA','SD'),
('TENNESSEE','TN'),('TEXAS','TX'),('UTAH','UT'),('VERMONT','VT'),('VIRGINIA','VA'),
('WASHINGTON','WA'),('WEST VIRGINIA','WV'),('WISCONSIN','WI'),('WYOMING','WY'),
('PUERTO RICO','PR'),
('QUEENS','NY'),('BROOKLYN','NY'),('BRONX','NY'),('MANHATTAN','NY'),('STATEN ISLAND','NY');

-- Full-name aware normalizer. Anything not in this table (e.g. 'Distrito
-- Nacional', 'Quintana Roo', 'San Juan') deliberately does NOT resolve.
CREATE OR REPLACE FUNCTION public.normalize_state_text(p_state text)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  WITH c AS (
    SELECT upper(btrim(regexp_replace(coalesce(p_state,''), '[^A-Za-z ]', '', 'g'))) AS txt
  )
  SELECT COALESCE(
    (SELECT n.state FROM public.us_state_names n, c WHERE n.name = c.txt),
    (SELECT c.txt FROM c
      WHERE length(c.txt) = 2
        AND EXISTS (SELECT 1 FROM public.recording_consent_policy p WHERE p.state = c.txt))
  );
$$;

ALTER TABLE public.brandaro_qualified_leads
  ADD COLUMN IF NOT EXISTS derived_state text,
  ADD COLUMN IF NOT EXISTS derived_timezone text,
  ADD COLUMN IF NOT EXISTS jurisdiction_source text,
  ADD COLUMN IF NOT EXISTS jurisdiction_confidence text,
  ADD COLUMN IF NOT EXISTS jurisdiction_resolved_at timestamptz;

ALTER TABLE public.brandaro_qualified_leads
  ADD COLUMN IF NOT EXISTS phone_last10 text
  GENERATED ALWAYS AS (right(regexp_replace(coalesce(phone_number,''), '\D', '', 'g'), 10)) STORED;
CREATE INDEX IF NOT EXISTS idx_bql_phone_last10 ON public.brandaro_qualified_leads (phone_last10);

CREATE OR REPLACE FUNCTION public.brandaro_lead_resolve_jurisdiction()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s text;
BEGIN
  s := public.normalize_state_text(NEW.state);
  IF s IS NULL THEN
    NEW.derived_state := NULL;
    NEW.derived_timezone := NULL;
    NEW.jurisdiction_source := 'unresolved';
    NEW.jurisdiction_confidence := 'none';
  ELSE
    NEW.derived_state := s;
    SELECT r.timezone INTO NEW.derived_timezone
      FROM public.zip_jurisdiction_ranges r WHERE r.state = s
      ORDER BY r.priority DESC, (r.zip_end - r.zip_start) DESC LIMIT 1;
    NEW.jurisdiction_source := 'state_text';
    NEW.jurisdiction_confidence := 'state_only';
  END IF;
  NEW.jurisdiction_resolved_at := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_bql_jurisdiction ON public.brandaro_qualified_leads;
CREATE TRIGGER trg_bql_jurisdiction
  BEFORE INSERT OR UPDATE OF state ON public.brandaro_qualified_leads
  FOR EACH ROW EXECUTE FUNCTION public.brandaro_lead_resolve_jurisdiction();

UPDATE public.brandaro_qualified_leads b
SET derived_state = public.normalize_state_text(b.state),
    derived_timezone = (SELECT r.timezone FROM public.zip_jurisdiction_ranges r
                        WHERE r.state = public.normalize_state_text(b.state)
                        ORDER BY r.priority DESC, (r.zip_end - r.zip_start) DESC LIMIT 1),
    jurisdiction_source = CASE WHEN public.normalize_state_text(b.state) IS NULL THEN 'unresolved' ELSE 'state_text' END,
    jurisdiction_confidence = CASE WHEN public.normalize_state_text(b.state) IS NULL THEN 'none' ELSE 'state_only' END,
    jurisdiction_resolved_at = now();

-- Re-resolve store_master state_text rows now that full names are understood.
UPDATE public.store_master sm
SET derived_state = public.normalize_state_text(sm.state),
    derived_timezone = (SELECT r.timezone FROM public.zip_jurisdiction_ranges r
                        WHERE r.state = public.normalize_state_text(sm.state)
                        ORDER BY r.priority DESC, (r.zip_end - r.zip_start) DESC LIMIT 1),
    jurisdiction_source = 'state_text',
    jurisdiction_confidence = 'state_only',
    jurisdiction_resolved_at = now()
WHERE sm.derived_state IS NULL AND public.normalize_state_text(sm.state) IS NOT NULL;

-- Consent read path now spans both lead universes; zip-derived wins.
CREATE OR REPLACE FUNCTION public.resolve_recording_consent(p_phone text)
RETURNS TABLE (state text, timezone text, consent_rule text, contested boolean, source text)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH l AS (SELECT right(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), 10) AS last10),
  cand AS (
    SELECT sm.derived_state AS st, sm.derived_timezone AS tz, sm.jurisdiction_source AS src,
           CASE WHEN sm.jurisdiction_source = 'zip' THEN 1 ELSE 2 END AS rank
    FROM public.store_master sm, l
    WHERE length(l.last10) = 10 AND sm.phone_last10 = l.last10 AND sm.derived_state IS NOT NULL
    UNION ALL
    SELECT b.derived_state, b.derived_timezone, b.jurisdiction_source, 3
    FROM public.brandaro_qualified_leads b, l
    WHERE length(l.last10) = 10 AND b.phone_last10 = l.last10 AND b.derived_state IS NOT NULL
  ),
  hit AS (SELECT * FROM cand ORDER BY rank LIMIT 1)
  SELECT h.st, h.tz,
         COALESCE(p.consent_rule, 'unknown'), COALESCE(p.contested, false), h.src
  FROM hit h LEFT JOIN public.recording_consent_policy p ON p.state = h.st;
$$;
