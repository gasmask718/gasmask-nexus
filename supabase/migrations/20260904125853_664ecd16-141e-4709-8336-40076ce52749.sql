-- Highway hub schema
CREATE TABLE IF NOT EXISTS public.hw_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket int CHECK (bucket IN (1,2)),
  business_name text NOT NULL,
  license_number text,
  license_type text,
  license_status text,
  state text NOT NULL CHECK (state ~ '^[A-Z]{2}$'),
  city text,
  address text,
  already_delivers boolean NOT NULL DEFAULT false,
  phone text,
  email text,
  website text,
  lat numeric(9,6),
  long numeric(9,6),
  source text,
  medical_flag boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS hw_leads_dedupe
  ON public.hw_leads (state, business_name, phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS hw_leads_geo ON public.hw_leads (lat, long);
CREATE INDEX IF NOT EXISTS hw_leads_state ON public.hw_leads (state);

CREATE TABLE IF NOT EXISTS public.hw_lead_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.hw_leads(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('new','outreach','contacted','qualified','demo','negotiation','signed','onboarded','lost')),
  notes text,
  contact_method text CHECK (contact_method IN ('phone','email','linkedin','in_person','referral')),
  team_member uuid,
  contacted_at timestamptz NOT NULL DEFAULT now(),
  next_action text,
  next_action_due timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hw_lead_stages_lead ON public.hw_lead_stages (lead_id, contacted_at DESC);

CREATE TABLE IF NOT EXISTS public.hw_outreach_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.hw_leads(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES public.hw_lead_stages(id) ON DELETE SET NULL,
  team_member uuid NOT NULL,
  channel text CHECK (channel IN ('call','email','linkedin','sms','in_person','video')),
  outcome text CHECK (outcome IN ('connected','voicemail','no_answer','bounced','replied','meeting_booked','not_interested','wrong_number')),
  duration_seconds int,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hw_outreach_log_lead ON public.hw_outreach_log (lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.hw_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  role text CHECK (role IN ('founder','sales_lead','sales_rep','ops','analyst')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.hw_leads TO authenticated;
GRANT SELECT, INSERT ON public.hw_lead_stages TO authenticated;
GRANT SELECT, INSERT ON public.hw_outreach_log TO authenticated;
GRANT SELECT ON public.hw_team_members TO authenticated;
GRANT ALL ON public.hw_leads TO service_role;
GRANT ALL ON public.hw_lead_stages TO service_role;
GRANT ALL ON public.hw_outreach_log TO service_role;
GRANT ALL ON public.hw_team_members TO service_role;

ALTER TABLE public.hw_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hw_lead_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hw_outreach_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hw_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read hw_leads" ON public.hw_leads
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert hw_leads" ON public.hw_leads
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated update hw_leads" ON public.hw_leads
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "team read own hw stages" ON public.hw_lead_stages
  FOR SELECT TO authenticated USING (auth.uid() = team_member);
CREATE POLICY "team insert own hw stages" ON public.hw_lead_stages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = team_member);

CREATE POLICY "team read own hw outreach" ON public.hw_outreach_log
  FOR SELECT TO authenticated USING (auth.uid() = team_member);
CREATE POLICY "team insert own hw outreach" ON public.hw_outreach_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = team_member);

CREATE POLICY "authenticated read hw_team_members" ON public.hw_team_members
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.hw_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hw_leads_touch ON public.hw_leads;
CREATE TRIGGER hw_leads_touch BEFORE UPDATE ON public.hw_leads
  FOR EACH ROW EXECUTE FUNCTION public.hw_touch_updated_at();

CREATE OR REPLACE VIEW public.v_hw_state_counts
WITH (security_invoker = on) AS
  SELECT state,
         count(*)::bigint AS leads,
         count(*) FILTER (WHERE phone IS NOT NULL)::bigint AS with_phone,
         count(*) FILTER (WHERE already_delivers)::bigint AS delivering,
         count(*) FILTER (WHERE bucket = 1)::bigint AS bucket_1,
         count(*) FILTER (WHERE bucket = 2)::bigint AS bucket_2
  FROM public.hw_leads
  GROUP BY state;

GRANT SELECT ON public.v_hw_state_counts TO authenticated;
REVOKE ALL ON public.v_hw_state_counts FROM anon;