ALTER TABLE public.brandaro_demo_sites
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '14 days');

UPDATE public.brandaro_demo_sites
  SET expires_at = created_at + interval '14 days'
  WHERE expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_brandaro_demo_sites_expiry
  ON public.brandaro_demo_sites (expires_at)
  WHERE converted_to_paid = false;