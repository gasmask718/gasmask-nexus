
-- SECTION 1: Snapshot columns on production_batches
ALTER TABLE public.production_batches
  ADD COLUMN IF NOT EXISTS conversion_lbs_per_box_snapshot numeric,
  ADD COLUMN IF NOT EXISTS conversion_boxes_per_lb_snapshot numeric,
  ADD COLUMN IF NOT EXISTS conversion_confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS conversion_confirmed_at timestamptz;

-- SECTION 2: Production conversion baseline table
CREATE TABLE IF NOT EXISTS public.production_conversion_baseline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid REFERENCES public.production_offices(id) ON DELETE CASCADE,
  baseline_boxes_per_lb numeric NOT NULL DEFAULT 0,
  baseline_lbs_per_box numeric NOT NULL DEFAULT 0,
  calculated_from_batch_count integer NOT NULL DEFAULT 0,
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(office_id)
);

-- Global baseline (office_id = NULL)
INSERT INTO public.production_conversion_baseline (office_id, baseline_boxes_per_lb, baseline_lbs_per_box, calculated_from_batch_count)
VALUES (NULL, 0, 0, 0)
ON CONFLICT (office_id) DO NOTHING;

ALTER TABLE public.production_conversion_baseline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read baselines"
  ON public.production_conversion_baseline FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage baselines"
  ON public.production_conversion_baseline FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- SECTION 3: Function to auto-recalculate baseline after batch approval
CREATE OR REPLACE FUNCTION public.recalculate_conversion_baseline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office_id uuid;
  v_count integer;
  v_avg_boxes_per_lb numeric;
  v_avg_lbs_per_box numeric;
BEGIN
  -- Only fire when moving to 'approved'
  IF NEW.inventory_state = 'approved' AND OLD.inventory_state <> 'approved' THEN
    v_office_id := NEW.office_id;

    -- Snapshot conversion ratios at approval time
    IF NEW.tobacco_lbs > 0 AND NEW.boxes_produced > 0 THEN
      NEW.conversion_lbs_per_box_snapshot := ROUND((NEW.tobacco_lbs / NEW.boxes_produced)::numeric, 4);
      NEW.conversion_boxes_per_lb_snapshot := ROUND((NEW.boxes_produced::numeric / NEW.tobacco_lbs)::numeric, 4);
    END IF;

    -- Recalculate office baseline
    SELECT COUNT(*), 
           CASE WHEN SUM(tobacco_lbs) > 0 THEN ROUND((SUM(boxes_produced)::numeric / SUM(tobacco_lbs))::numeric, 4) ELSE 0 END,
           CASE WHEN SUM(boxes_produced) > 0 THEN ROUND((SUM(tobacco_lbs) / SUM(boxes_produced))::numeric, 4) ELSE 0 END
    INTO v_count, v_avg_boxes_per_lb, v_avg_lbs_per_box
    FROM production_batches
    WHERE inventory_state = 'approved'
      AND tobacco_lbs > 0 AND boxes_produced > 0
      AND office_id = v_office_id;

    IF v_count >= 10 THEN
      INSERT INTO production_conversion_baseline (office_id, baseline_boxes_per_lb, baseline_lbs_per_box, calculated_from_batch_count, last_updated_at)
      VALUES (v_office_id, v_avg_boxes_per_lb, v_avg_lbs_per_box, v_count, now())
      ON CONFLICT (office_id) DO UPDATE SET
        baseline_boxes_per_lb = EXCLUDED.baseline_boxes_per_lb,
        baseline_lbs_per_box = EXCLUDED.baseline_lbs_per_box,
        calculated_from_batch_count = EXCLUDED.calculated_from_batch_count,
        last_updated_at = now();
    END IF;

    -- Recalculate global baseline
    SELECT COUNT(*),
           CASE WHEN SUM(tobacco_lbs) > 0 THEN ROUND((SUM(boxes_produced)::numeric / SUM(tobacco_lbs))::numeric, 4) ELSE 0 END,
           CASE WHEN SUM(boxes_produced) > 0 THEN ROUND((SUM(tobacco_lbs) / SUM(boxes_produced))::numeric, 4) ELSE 0 END
    INTO v_count, v_avg_boxes_per_lb, v_avg_lbs_per_box
    FROM production_batches
    WHERE inventory_state = 'approved'
      AND tobacco_lbs > 0 AND boxes_produced > 0;

    IF v_count >= 10 THEN
      INSERT INTO production_conversion_baseline (office_id, baseline_boxes_per_lb, baseline_lbs_per_box, calculated_from_batch_count, last_updated_at)
      VALUES (NULL, v_avg_boxes_per_lb, v_avg_lbs_per_box, v_count, now())
      ON CONFLICT (office_id) DO UPDATE SET
        baseline_boxes_per_lb = EXCLUDED.baseline_boxes_per_lb,
        baseline_lbs_per_box = EXCLUDED.baseline_lbs_per_box,
        calculated_from_batch_count = EXCLUDED.calculated_from_batch_count,
        last_updated_at = now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on production_batches
DROP TRIGGER IF EXISTS trg_recalculate_conversion_baseline ON public.production_batches;
CREATE TRIGGER trg_recalculate_conversion_baseline
  BEFORE UPDATE ON public.production_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_conversion_baseline();

-- SECTION 4: Prevent edits to locked fields after approval
CREATE OR REPLACE FUNCTION public.enforce_conversion_lock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If batch is approved or beyond, prevent edits to conversion-critical fields
  IF OLD.inventory_state IN ('approved', 'sent_to_office') THEN
    IF NEW.tobacco_lbs IS DISTINCT FROM OLD.tobacco_lbs
       OR NEW.boxes_produced IS DISTINCT FROM OLD.boxes_produced
       OR NEW.waste_lbs IS DISTINCT FROM OLD.waste_lbs THEN
      RAISE EXCEPTION 'Cannot modify conversion fields after batch is approved. Contact dynasty_owner for override.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_conversion_lock ON public.production_batches;
CREATE TRIGGER trg_enforce_conversion_lock
  BEFORE UPDATE ON public.production_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_conversion_lock();
