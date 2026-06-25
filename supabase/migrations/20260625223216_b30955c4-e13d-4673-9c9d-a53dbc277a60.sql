
CREATE TABLE IF NOT EXISTS public.ut_recruiting_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text CHECK (platform IN ('facebook','instagram','tiktok','linkedin','referral','other')),
  lead_type text CHECK (lead_type IN ('venue','staff','ambassador','kit_buyer')),
  name text,
  contact text,
  profile_url text,
  location text,
  notes text,
  status text DEFAULT 'new' CHECK (status IN ('new','contacted','interested','signed_up','declined')),
  follow_up_date date,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ut_recruiting_leads TO authenticated;
GRANT ALL ON public.ut_recruiting_leads TO service_role;

ALTER TABLE public.ut_recruiting_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view recruiting leads"
  ON public.ut_recruiting_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert recruiting leads"
  ON public.ut_recruiting_leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update recruiting leads"
  ON public.ut_recruiting_leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete recruiting leads"
  ON public.ut_recruiting_leads FOR DELETE TO authenticated USING (true);
