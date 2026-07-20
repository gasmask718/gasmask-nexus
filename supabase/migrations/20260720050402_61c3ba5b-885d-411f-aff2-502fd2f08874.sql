ALTER TABLE public.surplus_funds_leads
  ADD COLUMN IF NOT EXISTS dnc boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_surplus_funds_leads_dnc
  ON public.surplus_funds_leads (dnc) WHERE dnc = false;

COMMENT ON COLUMN public.surplus_funds_leads.dnc IS
  'Do Not Call flag. When true, this lead must NEVER be dialed by any automated (Bland) or manual outreach system. TCPA compliance.';