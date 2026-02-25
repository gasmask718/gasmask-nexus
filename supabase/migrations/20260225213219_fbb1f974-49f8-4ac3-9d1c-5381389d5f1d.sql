
-- Add version column to batch_cost_history for append-only versioning
ALTER TABLE public.batch_cost_history
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS override_reason TEXT,
  ADD COLUMN IF NOT EXISTS previous_version_id UUID REFERENCES public.batch_cost_history(id);

-- Trigger: block edits to locked fields on approved batches
CREATE OR REPLACE FUNCTION public.fn_guard_approved_batch_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce when batch_state is 'approved'
  IF OLD.batch_state = 'approved' THEN
    -- Check if any locked field changed
    IF (
      NEW.labor_model IS DISTINCT FROM OLD.labor_model OR
      NEW.worker_count IS DISTINCT FROM OLD.worker_count OR
      NEW.selected_worker_ids IS DISTINCT FROM OLD.selected_worker_ids OR
      NEW.labor_hourly_rate_snapshot IS DISTINCT FROM OLD.labor_hourly_rate_snapshot OR
      NEW.labor_per_box_rate_snapshot IS DISTINCT FROM OLD.labor_per_box_rate_snapshot OR
      NEW.labor_flat_day_rate_snapshot IS DISTINCT FROM OLD.labor_flat_day_rate_snapshot OR
      NEW.production_time_minutes IS DISTINCT FROM OLD.production_time_minutes OR
      NEW.changeover_minutes IS DISTINCT FROM OLD.changeover_minutes
    ) THEN
      -- Allow only if user is owner/dynasty_owner
      IF NOT public.has_role(auth.uid(), 'owner') THEN
        RAISE EXCEPTION 'LOCKED: Cannot modify cost fields on an approved batch. Owner override required.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_approved_batch_fields ON public.production_batches;
CREATE TRIGGER trg_guard_approved_batch_fields
  BEFORE UPDATE ON public.production_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_approved_batch_fields();
