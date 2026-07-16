
-- Phase 2B: Additive columns for store-scoped follow-ups on relationship_tasks.
-- All new columns are nullable — no existing data or behavior changes.
-- Note: spec asked for just route_flag, but store_id/created_by/completed_by
-- are required to (a) associate a task with a store and (b) stamp actors.
ALTER TABLE public.relationship_tasks
  ADD COLUMN IF NOT EXISTS route_flag boolean,
  ADD COLUMN IF NOT EXISTS store_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS completed_by uuid;

CREATE INDEX IF NOT EXISTS idx_relationship_tasks_store_open
  ON public.relationship_tasks (store_id, due_at)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_relationship_tasks_route_flag_due
  ON public.relationship_tasks (due_at, store_id)
  WHERE route_flag = true AND status = 'open';
