-- 1. Deactivate duplicate ACTIVE assignments, keeping the newest row per (ambassador, store).
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY ambassador_id, store_id
                            ORDER BY created_at DESC NULLS LAST, id) AS rn
  FROM public.ambassador_assignments
  WHERE active = true AND store_id IS NOT NULL
)
UPDATE public.ambassador_assignments a
SET active = false,
    unassigned_at = COALESCE(a.unassigned_at, now()),
    end_date = COALESCE(a.end_date, CURRENT_DATE),
    updated_at = now()
FROM ranked r
WHERE a.id = r.id AND r.rn > 1;

-- 2. Prevent duplicate ACTIVE assignments while preserving inactive history rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ambassador_assignments_active_store
  ON public.ambassador_assignments (ambassador_id, store_id)
  WHERE active = true AND store_id IS NOT NULL;