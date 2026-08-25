-- 1. business_leads accepts 'brightsun'
ALTER TABLE public.business_leads DROP CONSTRAINT IF EXISTS business_leads_business_known;
ALTER TABLE public.business_leads ADD CONSTRAINT business_leads_business_known
  CHECK (business = ANY (ARRAY['ut','toptier','dynasty','brandaro','gasmask','surplus','brightsun']));

-- brand access helper (admin/owner/developer)
CREATE OR REPLACE FUNCTION public.bs_brightsun_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','owner','developer')
  )
$$;

CREATE OR REPLACE FUNCTION public.bs_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- 2. bs_installers
CREATE TABLE public.bs_installers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business text NOT NULL DEFAULT 'brightsun',
  company_name text NOT NULL,
  external_place_id text,
  phone text,
  website text,
  office_address text,
  licence_state text,
  roc_licence_number text,
  licence_class text,
  licence_status text,
  licence_verified_at date,
  national boolean NOT NULL DEFAULT false,
  utility_territory text,
  financing_paths text[],
  accepts_tpo boolean,
  payout_model text,
  payout_amount numeric,
  capacity_per_week int,
  active boolean NOT NULL DEFAULT true,
  source text,
  source_ref text,
  status text NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified','verified','flagged','dropped')),
  notes text,
  crm_stage text NOT NULL DEFAULT 'identified' CHECK (crm_stage IN ('identified','contacted','interested','onboarded','active','declined')),
  last_contacted_at timestamptz,
  next_action text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bs_installers_place_uniq ON public.bs_installers (external_place_id) WHERE external_place_id IS NOT NULL;
CREATE INDEX bs_installers_stage_idx ON public.bs_installers (crm_stage);
CREATE INDEX bs_installers_state_idx ON public.bs_installers (licence_state);
CREATE TRIGGER bs_installers_touch BEFORE UPDATE ON public.bs_installers
  FOR EACH ROW EXECUTE FUNCTION public.bs_touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bs_installers TO authenticated;
GRANT ALL ON public.bs_installers TO service_role;
ALTER TABLE public.bs_installers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bs_installers_brand_access" ON public.bs_installers
  FOR ALL TO authenticated
  USING (business = 'brightsun' AND public.bs_brightsun_access(auth.uid()))
  WITH CHECK (business = 'brightsun' AND public.bs_brightsun_access(auth.uid()));

-- 3. bs_geo_policy
CREATE TABLE public.bs_geo_policy (
  vertical text NOT NULL DEFAULT 'solar',
  jurisdiction text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('S1','S2')),
  ingest_allowed boolean NOT NULL DEFAULT true,
  outbound_allowed boolean NOT NULL DEFAULT false,
  blocking_gate text,
  gate_cleared_at timestamptz,
  consent_standard text,
  call_window text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (vertical, jurisdiction)
);
CREATE TRIGGER bs_geo_policy_touch BEFORE UPDATE ON public.bs_geo_policy
  FOR EACH ROW EXECUTE FUNCTION public.bs_touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bs_geo_policy TO authenticated;
GRANT ALL ON public.bs_geo_policy TO service_role;
ALTER TABLE public.bs_geo_policy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bs_geo_policy_brand_access" ON public.bs_geo_policy
  FOR ALL TO authenticated
  USING (public.bs_brightsun_access(auth.uid()))
  WITH CHECK (public.bs_brightsun_access(auth.uid()));

INSERT INTO public.bs_geo_policy (vertical, jurisdiction, tier, blocking_gate, consent_standard) VALUES
  ('solar','CA','S1',NULL,'express_written'),
  ('solar','AZ','S1',NULL,'express_written'),
  ('solar','NV','S1',NULL,'express_written'),
  ('solar','TX','S1','TDLR solar retailer registration','express_written'),
  ('solar','FL','S1','FTSA one-to-one consent','one_to_one'),
  ('solar','NM','S1',NULL,'express_written'),
  ('solar','CO','S1','Consumer Protection Residential Energy Systems Act','state_plus'),
  ('solar','NJ','S1',NULL,'express_written'),
  ('solar','NY','S1',NULL,'express_written'),
  ('solar','MA','S1',NULL,'state_plus'),
  ('solar','CT','S1','SB233 third-party sales org reporting','state_plus'),
  ('solar','RI','S1','DBR retailer registration','state_plus'),
  ('solar','MD','S1','Stop the Spam Calls Act state_plus consent','state_plus'),
  ('solar','IL','S1',NULL,'express_written'),
  ('solar','PA','S1',NULL,'express_written'),
  ('solar','GA','S2',NULL,'express_written'),
  ('solar','NC','S2',NULL,'express_written'),
  ('solar','SC','S2',NULL,'express_written'),
  ('solar','VA','S2',NULL,'express_written'),
  ('solar','OH','S2',NULL,'express_written'),
  ('solar','MI','S2',NULL,'express_written'),
  ('solar','MN','S2',NULL,'express_written'),
  ('solar','WI','S2',NULL,'express_written'),
  ('solar','OR','S2',NULL,'express_written'),
  ('solar','WA','S2','WA CPA commercial solicitation restrictions','state_plus'),
  ('solar','UT','S2',NULL,'express_written'),
  ('solar','HI','S2',NULL,'express_written'),
  ('solar','NH','S2',NULL,'express_written'),
  ('solar','ME','S2',NULL,'express_written'),
  ('solar','VT','S2',NULL,'express_written'),
  ('solar','DE','S2',NULL,'express_written'),
  ('solar','DC','S2',NULL,'express_written');

-- 4. bs_crm_homeowner_leads
CREATE TABLE public.bs_crm_homeowner_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business text NOT NULL DEFAULT 'brightsun',
  full_name text NOT NULL,
  phone text,
  phone_last10 text GENERATED ALWAYS AS (right(regexp_replace(coalesce(phone,''), '\D', '', 'g'), 10)) STORED,
  email text,
  address text,
  city text,
  state text,
  zip text,
  financing_path text CHECK (financing_path IS NULL OR financing_path IN ('cash','loan','lease','ppa','prepaid')),
  has_battery_interest boolean,
  current_outage_frequency text,
  lead_score numeric,
  consent_artifact jsonb,
  source text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bs_homeowner_last10_idx ON public.bs_crm_homeowner_leads (phone_last10);
CREATE TRIGGER bs_homeowner_touch BEFORE UPDATE ON public.bs_crm_homeowner_leads
  FOR EACH ROW EXECUTE FUNCTION public.bs_touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bs_crm_homeowner_leads TO authenticated;
GRANT ALL ON public.bs_crm_homeowner_leads TO service_role;
ALTER TABLE public.bs_crm_homeowner_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bs_homeowner_brand_access" ON public.bs_crm_homeowner_leads
  FOR ALL TO authenticated
  USING (business = 'brightsun' AND public.bs_brightsun_access(auth.uid()))
  WITH CHECK (business = 'brightsun' AND public.bs_brightsun_access(auth.uid()));

-- 5. bs_consent_events
CREATE TABLE public.bs_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.bs_crm_homeowner_leads(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  artifact jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bs_consent_events_lead_idx ON public.bs_consent_events (lead_id);

GRANT SELECT, INSERT ON public.bs_consent_events TO authenticated;
GRANT ALL ON public.bs_consent_events TO service_role;
ALTER TABLE public.bs_consent_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bs_consent_events_brand_access" ON public.bs_consent_events
  FOR ALL TO authenticated
  USING (public.bs_brightsun_access(auth.uid()))
  WITH CHECK (public.bs_brightsun_access(auth.uid()));