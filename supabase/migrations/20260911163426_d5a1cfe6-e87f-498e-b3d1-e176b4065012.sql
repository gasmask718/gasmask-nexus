ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS start_address text,
  ADD COLUMN IF NOT EXISTS start_lat numeric,
  ADD COLUMN IF NOT EXISTS start_lng numeric,
  ADD COLUMN IF NOT EXISTS sequence_stale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS optimized_at timestamptz;

-- Remove the single stray Queens assignment from Ching's Brooklyn scope.
UPDATE public.ambassador_assignments
SET active = false,
    unassigned_at = now()
WHERE id = '7792a59f-713c-4728-9fbe-096e8a4d4cb4'
  AND ambassador_id = '903ecd8b-990f-456c-bdaf-18ef5f0b4317'
  AND active = true;