-- 1. Brand tag on the existing leads table (additive)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS business text DEFAULT 'gasmask';
UPDATE public.leads SET business = 'dynasty_direct' WHERE lead_type = 'wholesaler' AND business IS DISTINCT FROM 'dynasty_direct';
UPDATE public.leads SET business = 'gasmask' WHERE business IS NULL;
CREATE INDEX IF NOT EXISTS ix_leads_business ON public.leads (business);
CREATE INDEX IF NOT EXISTS ix_leads_business_geo ON public.leads (business, lat, lng);

GRANT SELECT, INSERT ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read leads" ON public.leads;
CREATE POLICY "authenticated read leads" ON public.leads
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated insert leads" ON public.leads;
CREATE POLICY "authenticated insert leads" ON public.leads
  FOR INSERT TO authenticated WITH CHECK (true);

-- 2. Dynasty Direct pipeline tables
CREATE TABLE IF NOT EXISTS public.dd_wholesaler_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wholesaler_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('identified','contacted','negotiated','contracted','active','inactive')),
  notes text,
  team_member uuid,
  contacted_at timestamptz NOT NULL DEFAULT now(),
  next_action text,
  next_action_due timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dd_wholesaler_stages_lead ON public.dd_wholesaler_stages (wholesaler_id, contacted_at DESC);

CREATE TABLE IF NOT EXISTS public.dd_outreach_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wholesaler_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES public.dd_wholesaler_stages(id) ON DELETE SET NULL,
  team_member uuid NOT NULL,
  channel text CHECK (channel IN ('call','email','sms','in_person')),
  outcome text CHECK (outcome IN ('connected','voicemail','no_answer','replied','meeting_booked','not_interested')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dd_outreach_log_lead ON public.dd_outreach_log (wholesaler_id, created_at DESC);

GRANT SELECT, INSERT ON public.dd_wholesaler_stages TO authenticated;
GRANT SELECT, INSERT ON public.dd_outreach_log TO authenticated;
GRANT ALL ON public.dd_wholesaler_stages TO service_role;
GRANT ALL ON public.dd_outreach_log TO service_role;

ALTER TABLE public.dd_wholesaler_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dd_outreach_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team read own dd stages" ON public.dd_wholesaler_stages
  FOR SELECT TO authenticated USING (auth.uid() = team_member);
CREATE POLICY "team insert own dd stages" ON public.dd_wholesaler_stages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = team_member);
CREATE POLICY "team read own dd outreach" ON public.dd_outreach_log
  FOR SELECT TO authenticated USING (auth.uid() = team_member);
CREATE POLICY "team insert own dd outreach" ON public.dd_outreach_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = team_member);

-- 3. State aggregates for the Dynasty Direct choropleth
CREATE OR REPLACE VIEW public.v_dd_state_counts
WITH (security_invoker = on) AS
  SELECT state,
         count(*) FILTER (WHERE business = 'gasmask')::bigint AS retail_leads,
         count(*) FILTER (WHERE business = 'dynasty_direct')::bigint AS wholesaler_leads,
         count(*) FILTER (WHERE phone_e164 IS NOT NULL)::bigint AS with_phone,
         count(*)::bigint AS total_leads
  FROM public.leads
  WHERE state IS NOT NULL
  GROUP BY state;

GRANT SELECT ON public.v_dd_state_counts TO authenticated;
REVOKE ALL ON public.v_dd_state_counts FROM anon;