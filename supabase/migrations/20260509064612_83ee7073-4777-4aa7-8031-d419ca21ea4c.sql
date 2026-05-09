ALTER TYPE public.store_status ADD VALUE IF NOT EXISTS 'reactivation_target';

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS reactivation_priority text
    CHECK (reactivation_priority IN ('cold_restart','warm_restart','easy_reorder')),
  ADD COLUMN IF NOT EXISTS reactivation_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reactivation_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS reactivated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_stores_reactivation_priority
  ON public.stores(reactivation_priority)
  WHERE reactivation_priority IS NOT NULL;