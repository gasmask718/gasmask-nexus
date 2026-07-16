
-- 1. Additive columns
ALTER TABLE public.store_opportunities
  ADD COLUMN IF NOT EXISTS due_date   timestamptz,
  ADD COLUMN IF NOT EXISTS assignee   uuid,
  ADD COLUMN IF NOT EXISTS priority   text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS route_flag boolean NOT NULL DEFAULT false;

-- 2. Extend source check to include 'follow_up'
ALTER TABLE public.store_opportunities
  DROP CONSTRAINT IF EXISTS store_opportunities_source_check;
ALTER TABLE public.store_opportunities
  ADD CONSTRAINT store_opportunities_source_check
  CHECK (source = ANY (ARRAY['manual','ai_extracted','follow_up']));

-- 3. Route-builder index: open opps flagged for routing, ordered by due date
CREATE INDEX IF NOT EXISTS idx_store_opportunities_route_open_due
  ON public.store_opportunities (due_date, store_id)
  WHERE route_flag = true AND is_completed = false;

-- 4. Migrate the one existing follow-up row from relationship_tasks
INSERT INTO public.store_opportunities
  (store_id, opportunity_text, source, is_completed,
   due_date, assignee, priority, route_flag,
   completed_at, completed_by, created_at, updated_at)
SELECT
  rt.store_id,
  COALESCE(NULLIF(rt.description, ''), rt.title) AS opportunity_text,
  'follow_up'::text,
  (rt.status = 'completed'),
  rt.due_at,
  NULL::uuid,
  COALESCE(rt.priority, 'normal'),
  COALESCE(rt.route_flag, false),
  rt.completed_at,
  rt.completed_by,
  COALESCE(rt.created_at, now()),
  now()
FROM public.relationship_tasks rt
WHERE rt.store_id IS NOT NULL
  AND rt.task_type = 'follow_up'
  AND NOT EXISTS (
    SELECT 1 FROM public.store_opportunities so
    WHERE so.store_id = rt.store_id
      AND so.opportunity_text = COALESCE(NULLIF(rt.description, ''), rt.title)
      AND so.source = 'follow_up'
  );
