
-- 1. ZIP -> jurisdiction lookup (static; no API, no cost)
CREATE TABLE public.zip_jurisdiction_ranges (
  id bigserial PRIMARY KEY,
  zip_start integer NOT NULL,
  zip_end integer NOT NULL,
  state text NOT NULL,
  timezone text NOT NULL,
  tz_precision text NOT NULL CHECK (tz_precision IN ('exact','state_dominant')),
  priority integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_zjr_range ON public.zip_jurisdiction_ranges (zip_start, zip_end);
GRANT SELECT ON public.zip_jurisdiction_ranges TO authenticated;
GRANT ALL ON public.zip_jurisdiction_ranges TO service_role;
ALTER TABLE public.zip_jurisdiction_ranges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zjr readable by authenticated" ON public.zip_jurisdiction_ranges FOR SELECT TO authenticated USING (true);

INSERT INTO public.zip_jurisdiction_ranges (zip_start, zip_end, state, timezone, tz_precision, priority) VALUES
(32400,32599,'FL','America/Chicago','exact',1),
(79821,79938,'TX','America/Denver','exact',1),
(88510,88589,'TX','America/Denver','exact',1),
(35004,36925,'AL','America/Chicago','exact',5),
(99501,99950,'AK','America/Anchorage','state_dominant',5),
(85001,86556,'AZ','America/Phoenix','state_dominant',5),
(71601,72959,'AR','America/Chicago','exact',5),
(90001,96162,'CA','America/Los_Angeles','exact',5),
(80001,81658,'CO','America/Denver','exact',5),
(6001,6928,'CT','America/New_York','exact',5),
(19701,19980,'DE','America/New_York','exact',5),
(20001,20039,'DC','America/New_York','exact',5),
(20042,20599,'DC','America/New_York','exact',5),
(20799,20799,'DC','America/New_York','exact',5),
(32004,34997,'FL','America/New_York','state_dominant',5),
(30001,31999,'GA','America/New_York','exact',5),
(39813,39897,'GA','America/New_York','exact',5),
(96701,96898,'HI','Pacific/Honolulu','exact',5),
(83201,83876,'ID','America/Boise','state_dominant',5),
(60001,62999,'IL','America/Chicago','exact',5),
(46001,47997,'IN','America/Indiana/Indianapolis','state_dominant',5),
(50001,52809,'IA','America/Chicago','exact',5),
(66002,67954,'KS','America/Chicago','state_dominant',5),
(40003,42788,'KY','America/New_York','state_dominant',5),
(70001,71232,'LA','America/Chicago','exact',5),
(71234,71497,'LA','America/Chicago','exact',5),
(3901,4992,'ME','America/New_York','exact',5),
(20331,20331,'MD','America/New_York','exact',5),
(20335,20797,'MD','America/New_York','exact',5),
(20812,21930,'MD','America/New_York','exact',5),
(1001,2791,'MA','America/New_York','exact',5),
(5501,5544,'MA','America/New_York','exact',5),
(48001,49971,'MI','America/Detroit','state_dominant',5),
(55001,56763,'MN','America/Chicago','exact',5),
(38601,39776,'MS','America/Chicago','exact',5),
(71233,71233,'MS','America/Chicago','exact',5),
(63001,65899,'MO','America/Chicago','exact',5),
(59001,59937,'MT','America/Denver','exact',5),
(68001,68118,'NE','America/Chicago','state_dominant',5),
(68122,69367,'NE','America/Chicago','state_dominant',5),
(88901,89883,'NV','America/Los_Angeles','state_dominant',5),
(3031,3897,'NH','America/New_York','exact',5),
(7001,8989,'NJ','America/New_York','exact',5),
(87001,88441,'NM','America/Denver','exact',5),
(6390,6390,'NY','America/New_York','exact',5),
(10001,14975,'NY','America/New_York','exact',5),
(27006,28909,'NC','America/New_York','exact',5),
(58001,58856,'ND','America/Chicago','state_dominant',5),
(43001,45999,'OH','America/New_York','exact',5),
(73001,73199,'OK','America/Chicago','exact',5),
(73401,74966,'OK','America/Chicago','exact',5),
(97001,97920,'OR','America/Los_Angeles','state_dominant',5),
(15001,19640,'PA','America/New_York','exact',5),
(600,988,'PR','America/Puerto_Rico','exact',5),
(2801,2940,'RI','America/New_York','exact',5),
(29001,29948,'SC','America/New_York','exact',5),
(57001,57799,'SD','America/Chicago','state_dominant',5),
(37010,38589,'TN','America/Chicago','state_dominant',5),
(73301,73301,'TX','America/Chicago','state_dominant',5),
(75001,75501,'TX','America/Chicago','state_dominant',5),
(75503,79999,'TX','America/Chicago','state_dominant',5),
(88510,88589,'TX','America/Chicago','state_dominant',5),
(84001,84784,'UT','America/Denver','exact',5),
(5001,5495,'VT','America/New_York','exact',5),
(5601,5907,'VT','America/New_York','exact',5),
(20040,20167,'VA','America/New_York','exact',5),
(20301,20598,'VA','America/New_York','exact',5),
(22001,24658,'VA','America/New_York','exact',5),
(98001,99403,'WA','America/Los_Angeles','exact',5),
(24701,26886,'WV','America/New_York','exact',5),
(53001,54990,'WI','America/Chicago','exact',5),
(82001,83128,'WY','America/Denver','exact',5);

-- 2. Recording consent policy: a table, not a Set in code.
CREATE TABLE public.recording_consent_policy (
  state text PRIMARY KEY,
  consent_rule text NOT NULL CHECK (consent_rule IN ('one_party','all_party','prohibited')),
  contested boolean NOT NULL DEFAULT false,
  effective_from date NOT NULL DEFAULT '1900-01-01',
  notes text,
  source text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.recording_consent_policy TO authenticated;
GRANT ALL ON public.recording_consent_policy TO service_role;
ALTER TABLE public.recording_consent_policy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rcp readable by authenticated" ON public.recording_consent_policy FOR SELECT TO authenticated USING (true);

INSERT INTO public.recording_consent_policy (state, consent_rule, contested) VALUES
('AL','one_party',false),('AK','one_party',false),('AZ','one_party',false),('AR','one_party',false),
('CA','all_party',false),('CO','one_party',false),('CT','all_party',true),('DE','all_party',true),
('DC','one_party',false),('FL','all_party',false),('GA','one_party',false),('HI','one_party',false),
('ID','one_party',false),('IL','all_party',true),('IN','one_party',false),('IA','one_party',false),
('KS','one_party',false),('KY','one_party',false),('LA','one_party',false),('ME','one_party',false),
('MD','all_party',false),('MA','all_party',false),('MI','all_party',true),('MN','one_party',false),
('MS','one_party',false),('MO','one_party',false),('MT','all_party',false),('NE','one_party',false),
('NV','all_party',true),('NH','all_party',false),('NJ','one_party',false),('NM','one_party',false),
('NY','one_party',false),('NC','one_party',false),('ND','one_party',false),('OH','one_party',false),
('OK','one_party',false),('OR','all_party',true),('PA','all_party',false),('PR','all_party',true),
('RI','one_party',false),('SC','one_party',false),('SD','one_party',false),('TN','one_party',false),
('TX','one_party',false),('UT','one_party',false),('VT','one_party',false),('VA','one_party',false),
('WA','all_party',false),('WV','one_party',false),('WI','one_party',false),('WY','one_party',false);

UPDATE public.recording_consent_policy SET notes = CASE state
  WHEN 'NV' THEN 'NRS 200.620 read as all-party for telephone calls (Lane v. Allstate); in-person is one-party. Treated all-party.'
  WHEN 'CT' THEN 'Criminal statute is one-party; CGS 52-570d creates civil liability for recording a telephone call without all-party consent. Treated all-party.'
  WHEN 'IL' THEN '720 ILCS 5/14-2 rewritten after People v. Clark; private-conversation recording still requires all-party consent. Treated all-party.'
  WHEN 'MI' THEN 'Statute is textually all-party; Sullivan v. Gray reads the participant exception as one-party. Treated all-party (conservative).'
  WHEN 'DE' THEN 'Wiretap statute all-party, privacy statute one-party. Treated all-party (conservative).'
  WHEN 'OR' THEN 'In-person all-party; telephone is one-party under ORS 165.540. Treated all-party (conservative) until reviewed.'
  WHEN 'PR' THEN 'Treated all-party (conservative); PR constitutional privacy protections.'
  ELSE notes END,
  source = 'Platform legal-posture table, seeded 2026-08-18. Conservative where contested. Review annually.';

-- 3. Derived jurisdiction on the lead
ALTER TABLE public.store_master
  ADD COLUMN IF NOT EXISTS derived_state text,
  ADD COLUMN IF NOT EXISTS derived_timezone text,
  ADD COLUMN IF NOT EXISTS jurisdiction_source text,
  ADD COLUMN IF NOT EXISTS jurisdiction_confidence text,
  ADD COLUMN IF NOT EXISTS jurisdiction_resolved_at timestamptz;

ALTER TABLE public.store_master
  ADD COLUMN IF NOT EXISTS phone_last10 text
  GENERATED ALWAYS AS (right(regexp_replace(coalesce(phone,''), '\D', '', 'g'), 10)) STORED;
CREATE INDEX IF NOT EXISTS idx_store_master_phone_last10 ON public.store_master (phone_last10);
CREATE INDEX IF NOT EXISTS idx_store_master_derived_state ON public.store_master (derived_state);

-- 4. Resolver: zip first, then a cleaned state string, then NOTHING.
--    Area code is deliberately NOT a source here: it is good enough for a
--    telemetry hint and not good enough to decide whether we may record.
CREATE OR REPLACE FUNCTION public.resolve_zip_jurisdiction(p_zip text)
RETURNS TABLE (state text, timezone text, tz_precision text)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT r.state, r.timezone, r.tz_precision
  FROM public.zip_jurisdiction_ranges r
  WHERE nullif(regexp_replace(coalesce(p_zip,''), '\D', '', 'g'), '') IS NOT NULL
    AND length(regexp_replace(p_zip, '\D', '', 'g')) >= 5
    AND left(regexp_replace(p_zip, '\D', '', 'g'), 5)::int BETWEEN r.zip_start AND r.zip_end
  ORDER BY r.priority, (r.zip_end - r.zip_start)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.normalize_state_text(p_state text)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE upper(btrim(regexp_replace(coalesce(p_state,''), '[^A-Za-z ]', '', 'g')))
    WHEN 'NEW YORK' THEN 'NY' WHEN 'QUEENS' THEN 'NY' WHEN 'BROOKLYN' THEN 'NY'
    WHEN 'BRONX' THEN 'NY' WHEN 'MANHATTAN' THEN 'NY' WHEN 'STATEN ISLAND' THEN 'NY'
    WHEN 'NEW JERSEY' THEN 'NJ' WHEN 'CONNECTICUT' THEN 'CT' WHEN 'PENNSYLVANIA' THEN 'PA'
    WHEN 'FLORIDA' THEN 'FL' WHEN 'CALIFORNIA' THEN 'CA' WHEN 'TEXAS' THEN 'TX'
    WHEN 'USA' THEN NULL WHEN '' THEN NULL
    ELSE (SELECT s FROM (SELECT upper(btrim(regexp_replace(coalesce(p_state,''), '[^A-Za-z]', '', 'g'))) s) t
          WHERE length(t.s) = 2 AND EXISTS (SELECT 1 FROM public.recording_consent_policy p WHERE p.state = t.s))
  END;
$$;

CREATE OR REPLACE FUNCTION public.store_master_resolve_jurisdiction()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE z record; s text;
BEGIN
  SELECT * INTO z FROM public.resolve_zip_jurisdiction(NEW.zip);
  IF z.state IS NOT NULL THEN
    NEW.derived_state := z.state;
    NEW.derived_timezone := z.timezone;
    NEW.jurisdiction_source := 'zip';
    NEW.jurisdiction_confidence := CASE WHEN z.tz_precision = 'exact' THEN 'high' ELSE 'state_exact_tz_dominant' END;
    NEW.jurisdiction_resolved_at := now();
    RETURN NEW;
  END IF;
  s := public.normalize_state_text(NEW.state);
  IF s IS NOT NULL THEN
    NEW.derived_state := s;
    SELECT r.timezone INTO NEW.derived_timezone
      FROM public.zip_jurisdiction_ranges r WHERE r.state = s ORDER BY r.priority DESC, (r.zip_end - r.zip_start) DESC LIMIT 1;
    NEW.jurisdiction_source := 'state_text';
    NEW.jurisdiction_confidence := 'state_only';
    NEW.jurisdiction_resolved_at := now();
    RETURN NEW;
  END IF;
  NEW.derived_state := NULL;
  NEW.derived_timezone := NULL;
  NEW.jurisdiction_source := 'unresolved';
  NEW.jurisdiction_confidence := 'none';
  NEW.jurisdiction_resolved_at := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_store_master_jurisdiction ON public.store_master;
CREATE TRIGGER trg_store_master_jurisdiction
  BEFORE INSERT OR UPDATE OF zip, state ON public.store_master
  FOR EACH ROW EXECUTE FUNCTION public.store_master_resolve_jurisdiction();

-- 5. Backfill (touches only the new derived columns)
UPDATE public.store_master sm
SET derived_state = q.state,
    derived_timezone = q.timezone,
    jurisdiction_source = 'zip',
    jurisdiction_confidence = CASE WHEN q.tz_precision = 'exact' THEN 'high' ELSE 'state_exact_tz_dominant' END,
    jurisdiction_resolved_at = now()
FROM (
  SELECT s.id, z.state, z.timezone, z.tz_precision
  FROM public.store_master s
  CROSS JOIN LATERAL public.resolve_zip_jurisdiction(s.zip) z
) q
WHERE q.id = sm.id AND q.state IS NOT NULL;

UPDATE public.store_master sm
SET derived_state = public.normalize_state_text(sm.state),
    derived_timezone = (SELECT r.timezone FROM public.zip_jurisdiction_ranges r
                        WHERE r.state = public.normalize_state_text(sm.state)
                        ORDER BY r.priority DESC, (r.zip_end - r.zip_start) DESC LIMIT 1),
    jurisdiction_source = 'state_text',
    jurisdiction_confidence = 'state_only',
    jurisdiction_resolved_at = now()
WHERE sm.derived_state IS NULL AND public.normalize_state_text(sm.state) IS NOT NULL;

UPDATE public.store_master
SET jurisdiction_source = 'unresolved', jurisdiction_confidence = 'none', jurisdiction_resolved_at = now()
WHERE derived_state IS NULL;

-- 6. The gate's read path: phone -> consent rule. Fails to 'unknown' by design.
CREATE OR REPLACE FUNCTION public.resolve_recording_consent(p_phone text)
RETURNS TABLE (state text, timezone text, consent_rule text, contested boolean, source text)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH l AS (SELECT right(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), 10) AS last10),
  hit AS (
    SELECT sm.derived_state, sm.derived_timezone, sm.jurisdiction_source
    FROM public.store_master sm, l
    WHERE length(l.last10) = 10 AND sm.phone_last10 = l.last10 AND sm.derived_state IS NOT NULL
    ORDER BY (sm.jurisdiction_source = 'zip') DESC
    LIMIT 1
  )
  SELECT h.derived_state, h.derived_timezone,
         COALESCE(p.consent_rule, 'unknown'), COALESCE(p.contested, false), h.jurisdiction_source
  FROM hit h LEFT JOIN public.recording_consent_policy p ON p.state = h.derived_state;
$$;
GRANT EXECUTE ON FUNCTION public.resolve_recording_consent(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_zip_jurisdiction(text) TO authenticated, service_role;
