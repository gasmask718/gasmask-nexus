ALTER TABLE public.uben_programs
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS eligibility text,
  ADD COLUMN IF NOT EXISTS how_to_apply text;