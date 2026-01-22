-- =====================================================
-- COMMISSION LEDGER GUARDRAILS & STATUS MANAGEMENT
-- Phase 2: Authoritative Ledger Flow
-- =====================================================

-- 1️⃣ ADD STATUS CHECK CONSTRAINT (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'commission_ledger_status_check'
  ) THEN
    ALTER TABLE public.commission_ledger 
    ADD CONSTRAINT commission_ledger_status_check 
    CHECK (status IN ('pending', 'approved', 'paid', 'reversed'));
  END IF;
END $$;

-- 2️⃣ ADD source_name COLUMN (for human-readable statements)
ALTER TABLE public.commission_ledger 
  ADD COLUMN IF NOT EXISTS source_name text;

-- 3️⃣ UPDATE STATUS VALIDATION TRIGGER (enforce valid transitions)
CREATE OR REPLACE FUNCTION public.validate_ledger_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only validate status changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Valid transitions:
  -- pending → approved
  -- approved → paid
  -- pending → reversed (via reversal row, not direct edit - but allow for flexibility)
  -- approved → reversed (if needed before payout)
  
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'reversed') THEN
    IF NEW.status = 'approved' THEN
      NEW.approved_at := COALESCE(NEW.approved_at, NOW());
    END IF;
    RETURN NEW;
  END IF;
  
  IF OLD.status = 'approved' AND NEW.status IN ('paid', 'reversed') THEN
    IF NEW.status = 'paid' THEN
      NEW.paid_at := COALESCE(NEW.paid_at, NOW());
    END IF;
    RETURN NEW;
  END IF;
  
  -- Disallow any other transitions
  RAISE EXCEPTION 'Invalid status transition: % → %. Allowed: pending→approved, approved→paid, pending/approved→reversed', 
    OLD.status, NEW.status;
END;
$$;

-- Drop and recreate trigger to ensure latest function is used
DROP TRIGGER IF EXISTS trg_validate_ledger_status ON public.commission_ledger;
CREATE TRIGGER trg_validate_ledger_status
  BEFORE UPDATE OF status ON public.commission_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_ledger_status_transition();

-- 4️⃣ APPROVE COMMISSION FUNCTION (pending → approved)
CREATE OR REPLACE FUNCTION public.approve_commission(
  p_ledger_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE commission_ledger
  SET status = 'approved',
      approved_at = NOW()
  WHERE id = p_ledger_id
    AND status = 'pending';
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commission % not found or not in pending status', p_ledger_id;
  END IF;
END;
$$;

-- 5️⃣ BULK APPROVE FUNCTION (for admin efficiency)
CREATE OR REPLACE FUNCTION public.bulk_approve_commissions(
  p_ambassador_id uuid DEFAULT NULL,
  p_before_date timestamptz DEFAULT NOW()
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE commission_ledger
  SET status = 'approved',
      approved_at = NOW()
  WHERE status = 'pending'
    AND earned_at <= p_before_date
    AND (p_ambassador_id IS NULL OR ambassador_id = p_ambassador_id);
    
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 6️⃣ MANUAL REVERSAL FUNCTION (creates negative entry)
CREATE OR REPLACE FUNCTION public.create_commission_reversal(
  p_ledger_id uuid,
  p_reason text DEFAULT 'Manual reversal'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id uuid;
  v_original RECORD;
BEGIN
  -- Get original entry
  SELECT * INTO v_original
  FROM commission_ledger
  WHERE id = p_ledger_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commission ledger entry % not found', p_ledger_id;
  END IF;
  
  -- Cannot reverse already reversed or paid entries
  IF v_original.status = 'reversed' THEN
    RAISE EXCEPTION 'Cannot reverse an already reversed entry';
  END IF;
  
  IF v_original.status = 'paid' THEN
    RAISE EXCEPTION 'Cannot reverse a paid entry. Use dispute flow instead.';
  END IF;
  
  -- Check if reversal already exists
  IF EXISTS (
    SELECT 1 FROM commission_ledger WHERE reversal_of = p_ledger_id
  ) THEN
    RAISE EXCEPTION 'A reversal for this entry already exists';
  END IF;
  
  -- Create reversal row (negative amount)
  INSERT INTO commission_ledger (
    ambassador_id,
    store_id,
    source_channel,
    source_id,
    source_name,
    gross_amount,
    commission_rate,
    commission_amount,
    commission_plan_id,
    status,
    earned_at,
    reversal_of
  ) VALUES (
    v_original.ambassador_id,
    v_original.store_id,
    v_original.source_channel,
    v_original.source_id,
    COALESCE(p_reason, 'Reversal of ' || v_original.source_name),
    v_original.gross_amount,
    v_original.commission_rate,
    v_original.commission_amount * -1,  -- Negative amount
    v_original.commission_plan_id,
    'reversed',
    NOW(),
    p_ledger_id
  )
  RETURNING id INTO v_new_id;
  
  -- Mark original as reversed
  UPDATE commission_ledger
  SET status = 'reversed'
  WHERE id = p_ledger_id;
  
  RETURN v_new_id;
END;
$$;

-- 7️⃣ PAYOUT ELIGIBILITY VIEW (single source of truth)
CREATE OR REPLACE VIEW public.payout_eligible_commissions AS
SELECT 
  cl.id,
  cl.ambassador_id,
  cl.store_id,
  cl.source_channel,
  cl.source_id,
  cl.source_name,
  cl.gross_amount,
  cl.commission_rate,
  cl.commission_amount,
  cl.earned_at,
  cl.approved_at,
  a.name as ambassador_name,
  sm.store_name
FROM public.commission_ledger cl
JOIN public.ambassadors a ON a.id = cl.ambassador_id
LEFT JOIN public.store_master sm ON sm.id = cl.store_id
WHERE cl.status = 'approved'
  AND cl.paid_at IS NULL
  AND cl.payout_batch_id IS NULL
  AND cl.commission_amount > 0;

-- 8️⃣ UPDATE STORE ORDER TRIGGER TO SET source_name
CREATE OR REPLACE FUNCTION public.create_store_order_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ambassador_id uuid;
  v_plan_id uuid;
  v_rate numeric(5,2);
  v_commission_amount numeric(10,2);
  v_store_name text;
BEGIN
  -- Only fire on qualifying status change
  IF NEW.status NOT IN ('delivered', 'completed') THEN
    RETURN NEW;
  END IF;

  -- IDEMPOTENCY: Prevent double commissions
  IF EXISTS (
    SELECT 1 FROM commission_ledger
    WHERE source_channel = 'store_order' AND source_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Find active ambassador assignment for this store
  SELECT aa.ambassador_id INTO v_ambassador_id
  FROM ambassador_assignments aa
  WHERE aa.store_id = NEW.store_id AND aa.active = true
  ORDER BY aa.is_primary DESC NULLS LAST, aa.start_date ASC
  LIMIT 1;

  IF v_ambassador_id IS NULL THEN RETURN NEW; END IF;

  -- Find applicable commission plan
  SELECT cp.id, COALESCE(cp.default_rate, 0) INTO v_plan_id, v_rate
  FROM commission_plans cp
  WHERE cp.active = true AND cp.applies_to = 'store'
    AND (cp.effective_to IS NULL OR cp.effective_to >= current_date)
    AND cp.effective_from <= current_date
  ORDER BY cp.effective_from DESC LIMIT 1;

  IF v_plan_id IS NULL THEN RETURN NEW; END IF;

  -- Get store name for readable source_name
  SELECT store_name INTO v_store_name
  FROM store_master WHERE id = NEW.store_id;

  v_commission_amount := ROUND(NEW.total_amount * (v_rate / 100), 2);

  INSERT INTO commission_ledger (
    ambassador_id, store_id, source_channel, source_id, source_name,
    gross_amount, commission_rate, commission_amount,
    commission_plan_id, status, earned_at
  ) VALUES (
    v_ambassador_id, NEW.store_id, 'store_order', NEW.id, 
    COALESCE(v_store_name, 'Store Order'),
    NEW.total_amount, v_rate, v_commission_amount,
    v_plan_id, 'pending', NOW()
  );

  RETURN NEW;
END;
$$;

-- 9️⃣ UPDATE WHOLESALE ORDER TRIGGER TO SET source_name
CREATE OR REPLACE FUNCTION public.create_wholesale_order_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ambassador_id uuid;
  v_plan_id uuid;
  v_rate numeric(5,2);
  v_commission_amount numeric(10,2);
  v_wholesaler_name text;
BEGIN
  IF NEW.fulfillment_status NOT IN ('fulfilled', 'completed', 'delivered') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM commission_ledger
    WHERE source_channel = 'wholesale_order' AND source_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT aa.ambassador_id INTO v_ambassador_id
  FROM ambassador_assignments aa
  WHERE aa.wholesaler_id = NEW.wholesaler_id AND aa.active = true
  ORDER BY aa.is_primary DESC NULLS LAST, aa.start_date ASC
  LIMIT 1;

  IF v_ambassador_id IS NULL THEN RETURN NEW; END IF;

  SELECT cp.id, COALESCE(cp.default_rate, 0) INTO v_plan_id, v_rate
  FROM commission_plans cp
  WHERE cp.active = true AND cp.applies_to = 'wholesale'
    AND (cp.effective_to IS NULL OR cp.effective_to >= current_date)
    AND cp.effective_from <= current_date
  ORDER BY cp.effective_from DESC LIMIT 1;

  IF v_plan_id IS NULL THEN RETURN NEW; END IF;

  -- Get wholesaler name for readable source_name
  SELECT company_name INTO v_wholesaler_name
  FROM wholesale_hubs WHERE id = NEW.wholesaler_id;

  v_commission_amount := ROUND(NEW.total * (v_rate / 100), 2);

  INSERT INTO commission_ledger (
    ambassador_id, store_id, source_channel, source_id, source_name,
    gross_amount, commission_rate, commission_amount,
    commission_plan_id, status, earned_at
  ) VALUES (
    v_ambassador_id, NULL, 'wholesale_order', NEW.id,
    COALESCE(v_wholesaler_name, 'Wholesale Order'),
    NEW.total, v_rate, v_commission_amount,
    v_plan_id, 'pending', NOW()
  );

  RETURN NEW;
END;
$$;

-- 🔟 GRANT EXECUTE ON NEW FUNCTIONS
GRANT EXECUTE ON FUNCTION public.approve_commission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_approve_commissions(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_commission_reversal(uuid, text) TO authenticated;