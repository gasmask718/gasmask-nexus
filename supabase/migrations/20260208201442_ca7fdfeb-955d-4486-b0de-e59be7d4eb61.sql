
-- ============================================================
-- FLEXIBLE PAY UNITS: per_day / per_box / per_bag / per_batch / per_unit
-- ============================================================

-- Step 1: Add bags_cleaned to worker submissions
ALTER TABLE public.production_worker_submissions
ADD COLUMN IF NOT EXISTS bags_cleaned integer NOT NULL DEFAULT 0;

-- Step 2: Replace create_earning_from_submission with multi-unit logic
CREATE OR REPLACE FUNCTION public.create_earning_from_submission(
  p_submission_id uuid,
  p_worker_id uuid,
  p_batch_id uuid,
  p_office_id uuid,
  p_quantity numeric DEFAULT 1,
  p_approved_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay_rate numeric;
  v_pay_type text;
  v_earnings numeric;
  v_quantity numeric;
  v_unit_type text;
  v_earning_id uuid;
  v_submission record;
BEGIN
  -- Get worker's current pay config
  SELECT pay_rate, pay_type INTO v_pay_rate, v_pay_type
  FROM production_workers
  WHERE id = p_worker_id;
  
  IF v_pay_rate IS NULL OR v_pay_rate = 0 THEN
    RAISE EXCEPTION 'Worker % has no pay rate configured', p_worker_id;
  END IF;

  -- Read submission data for quantity mapping
  SELECT boxes_packed, bags_cleaned, tubes_produced, lbs_processed
  INTO v_submission
  FROM production_worker_submissions
  WHERE id = p_submission_id;

  -- Calculate based on pay type
  CASE v_pay_type
    WHEN 'per_day' THEN
      v_quantity := 1;
      v_unit_type := 'day';
      v_earnings := v_pay_rate;

    WHEN 'per_batch' THEN
      v_quantity := 1;
      v_unit_type := 'batch';
      v_earnings := v_pay_rate;

    WHEN 'per_box' THEN
      v_quantity := COALESCE(v_submission.boxes_packed, 0);
      v_unit_type := 'box';
      IF v_quantity = 0 THEN
        RAISE EXCEPTION 'Cannot create per_box earning: submission has 0 boxes_packed';
      END IF;
      v_earnings := v_pay_rate * v_quantity;

    WHEN 'per_bag' THEN
      v_quantity := COALESCE(v_submission.bags_cleaned, 0);
      v_unit_type := 'bag';
      IF v_quantity = 0 THEN
        RAISE EXCEPTION 'Cannot create per_bag earning: submission has 0 bags_cleaned';
      END IF;
      v_earnings := v_pay_rate * v_quantity;

    WHEN 'per_unit' THEN
      -- per_unit uses the p_quantity param (generic)
      v_quantity := COALESCE(p_quantity, 0);
      v_unit_type := 'unit';
      IF v_quantity = 0 THEN
        RAISE EXCEPTION 'Cannot create per_unit earning: quantity is 0';
      END IF;
      v_earnings := v_pay_rate * v_quantity;

    ELSE
      -- Fallback: treat as per_batch
      v_quantity := 1;
      v_unit_type := 'batch';
      v_earnings := v_pay_rate;
  END CASE;

  -- Insert immutable earning record
  INSERT INTO production_worker_earnings (
    worker_id, batch_id, submission_id, office_id,
    earnings_amount, pay_rate_at_time, pay_type_at_time,
    quantity_completed, unit_type, status,
    approved_at, approved_by
  ) VALUES (
    p_worker_id, p_batch_id, p_submission_id, p_office_id,
    v_earnings, v_pay_rate, v_pay_type,
    v_quantity, v_unit_type, 'approved',
    now(), p_approved_by
  )
  RETURNING id INTO v_earning_id;
  
  RETURN v_earning_id;
END;
$$;
