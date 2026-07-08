
ALTER TABLE public.grant_opportunities
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS eligibility_requirements text,
  ADD COLUMN IF NOT EXISTS funder text,
  ADD COLUMN IF NOT EXISTS amount numeric,
  ADD COLUMN IF NOT EXISTS deadline date,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'open'
    CHECK (status IN ('open','closed','draft','archived'));

ALTER TABLE public.grant_requirements
  ADD COLUMN IF NOT EXISTS weight integer DEFAULT 5;
