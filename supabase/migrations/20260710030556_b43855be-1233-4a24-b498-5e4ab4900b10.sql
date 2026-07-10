-- Grant OS §6/§13 fixes: allow spec-required interaction types, add task metadata

-- 1) grant_funder_interactions: extend interaction_type check to include the
--    spec's internal values ('phone', 'site_visit') without removing existing ones.
ALTER TABLE public.grant_funder_interactions
  DROP CONSTRAINT IF EXISTS grant_funder_interactions_interaction_type_check;

ALTER TABLE public.grant_funder_interactions
  ADD CONSTRAINT grant_funder_interactions_interaction_type_check
  CHECK (interaction_type = ANY (ARRAY[
    'email','call','phone','meeting','site_visit',
    'application_submitted','award_received','rejection_received',
    'follow_up','note','other'
  ]));

-- 2) grant_tasks: add created_by (uuid) and make default status 'pending'.
ALTER TABLE public.grant_tasks
  ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE public.grant_tasks
  ALTER COLUMN status SET DEFAULT 'pending';

-- Backfill: keep legacy 'open' rows readable but map them to the new default going forward.
-- (Non-destructive: only touches rows that were never worked on.)
UPDATE public.grant_tasks
  SET status = 'pending'
  WHERE status = 'open';