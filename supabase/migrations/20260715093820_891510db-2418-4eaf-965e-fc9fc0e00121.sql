
ALTER TABLE public.re_leads
  ADD COLUMN IF NOT EXISTS phones_detail jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS emails_detail jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS litigator boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS company_name text;

CREATE INDEX IF NOT EXISTS idx_re_leads_litigator ON public.re_leads(litigator) WHERE litigator = true;
