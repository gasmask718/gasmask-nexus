-- Option A: the product never captures a full SSN. The ssn_encrypted column is
-- verified 100% NULL (0 of 4 rows populated) and is no longer written by any code path.
-- Column-level REVOKE was ineffective because the table-level SELECT grant supersedes it,
-- so the column is dropped outright.
ALTER TABLE public.funding_clients DROP COLUMN IF EXISTS ssn_encrypted;

COMMENT ON COLUMN public.funding_clients.ssn_last4 IS
  'Last 4 digits of SSN only. Full SSNs are never collected or stored anywhere in this system (Stage 0, Option A).';