ALTER TABLE public.brandaro_demo_sites
  ADD COLUMN IF NOT EXISTS cta_clicked boolean NOT NULL DEFAULT false;