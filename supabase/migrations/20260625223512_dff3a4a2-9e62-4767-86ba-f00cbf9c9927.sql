
ALTER TABLE public.ut_recruiting_leads
  ADD COLUMN IF NOT EXISTS handle text,
  ADD COLUMN IF NOT EXISTS follower_count int,
  ADD COLUMN IF NOT EXISTS outreach_message text,
  ADD COLUMN IF NOT EXISTS signed_up_at timestamptz;

-- Expand platform check
ALTER TABLE public.ut_recruiting_leads DROP CONSTRAINT IF EXISTS ut_recruiting_leads_platform_check;
ALTER TABLE public.ut_recruiting_leads ADD CONSTRAINT ut_recruiting_leads_platform_check
  CHECK (platform IS NULL OR platform IN ('instagram','facebook','tiktok','linkedin','twitter','text','email','referral','other'));

-- Expand lead_type check
ALTER TABLE public.ut_recruiting_leads DROP CONSTRAINT IF EXISTS ut_recruiting_leads_lead_type_check;
ALTER TABLE public.ut_recruiting_leads ADD CONSTRAINT ut_recruiting_leads_lead_type_check
  CHECK (lead_type IS NULL OR lead_type IN ('ambassador','venue','staff','kit_buyer','rental'));

-- Expand status check (include both old 'new' and new 'identified' to avoid breaking existing rows)
ALTER TABLE public.ut_recruiting_leads DROP CONSTRAINT IF EXISTS ut_recruiting_leads_status_check;
ALTER TABLE public.ut_recruiting_leads ADD CONSTRAINT ut_recruiting_leads_status_check
  CHECK (status IN ('new','identified','contacted','responded','interested','signed_up','declined','no_response'));

ALTER TABLE public.ut_recruiting_leads ALTER COLUMN status SET DEFAULT 'identified';

DROP POLICY IF EXISTS "Service role full access" ON public.ut_recruiting_leads;
CREATE POLICY "Service role full access" ON public.ut_recruiting_leads
  FOR ALL TO service_role USING (true) WITH CHECK (true);
