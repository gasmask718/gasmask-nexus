ALTER TABLE public.brandaro_demo_sites
  ADD COLUMN IF NOT EXISTS deployment_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.brandaro_demo_sites
  DROP CONSTRAINT IF EXISTS brandaro_demo_sites_deployment_status_check;

ALTER TABLE public.brandaro_demo_sites
  ADD CONSTRAINT brandaro_demo_sites_deployment_status_check
  CHECK (deployment_status IN ('pending','deploying','live','failed','expired'));

UPDATE public.brandaro_demo_sites
SET deployment_status = CASE
  WHEN public_status = 'live' THEN 'live'
  ELSE 'pending'
END;

CREATE INDEX IF NOT EXISTS idx_brandaro_demo_sites_deployment_status
  ON public.brandaro_demo_sites (deployment_status, expires_at);