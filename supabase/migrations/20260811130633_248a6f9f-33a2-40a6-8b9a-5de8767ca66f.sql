ALTER TABLE public.funding_clients
  ADD COLUMN IF NOT EXISTS personal_guarantee_ok boolean;

COMMENT ON COLUMN public.funding_clients.personal_guarantee_ok IS
  'NULL = unknown (matching returns MANUAL_REVIEW for PG lenders), true = client accepts a personal guarantee, false = client refuses.';