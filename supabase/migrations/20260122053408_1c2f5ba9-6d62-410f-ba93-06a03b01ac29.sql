-- =============================================
-- COMMISSION TRIGGERS (Authoritative)
-- Prime Directive: Fires when value is earned, not when intent is expressed
-- =============================================

-- 1️⃣ STORE ORDER COMMISSION TRIGGER FUNCTION
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

  v_commission_amount := ROUND(NEW.total_amount * (v_rate / 100), 2);

  INSERT INTO commission_ledger (
    ambassador_id, store_id, source_channel, source_id,
    gross_amount, commission_rate, commission_amount,
    commission_plan_id, status, earned_at
  ) VALUES (
    v_ambassador_id, NEW.store_id, 'store_order', NEW.id,
    NEW.total_amount, v_rate, v_commission_amount,
    v_plan_id, 'pending', NOW()
  );

  RETURN NEW;
END;
$$;

-- 2️⃣ ATTACH TRIGGER TO store_orders
DROP TRIGGER IF EXISTS trg_store_order_commission ON public.store_orders;
CREATE TRIGGER trg_store_order_commission
AFTER UPDATE OF status ON public.store_orders
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.create_store_order_commission();

-- 3️⃣ WHOLESALE ORDER COMMISSION TRIGGER (uses fulfillment_status)
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

  v_commission_amount := ROUND(NEW.total * (v_rate / 100), 2);

  INSERT INTO commission_ledger (
    ambassador_id, store_id, source_channel, source_id,
    gross_amount, commission_rate, commission_amount,
    commission_plan_id, status, earned_at
  ) VALUES (
    v_ambassador_id, NULL, 'wholesale_order', NEW.id,
    NEW.total, v_rate, v_commission_amount,
    v_plan_id, 'pending', NOW()
  );

  RETURN NEW;
END;
$$;

-- 4️⃣ ATTACH TRIGGER TO marketplace_orders
DROP TRIGGER IF EXISTS trg_wholesale_order_commission ON public.marketplace_orders;
CREATE TRIGGER trg_wholesale_order_commission
AFTER UPDATE OF fulfillment_status ON public.marketplace_orders
FOR EACH ROW WHEN (OLD.fulfillment_status IS DISTINCT FROM NEW.fulfillment_status)
EXECUTE FUNCTION public.create_wholesale_order_commission();

-- 5️⃣ REVERSAL TRIGGER FOR store_orders
CREATE OR REPLACE FUNCTION public.create_store_order_reversal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original_ledger RECORD;
BEGIN
  IF NEW.status NOT IN ('cancelled', 'refunded') THEN RETURN NEW; END IF;

  SELECT * INTO v_original_ledger FROM commission_ledger
  WHERE source_id = NEW.id AND source_channel = 'store_order'
    AND status != 'reversed' AND reversal_of IS NULL
  LIMIT 1;

  IF v_original_ledger.id IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM commission_ledger WHERE reversal_of = v_original_ledger.id) THEN RETURN NEW; END IF;

  INSERT INTO commission_ledger (
    ambassador_id, store_id, source_channel, source_id,
    gross_amount, commission_rate, commission_amount,
    commission_plan_id, status, earned_at, reversal_of
  ) VALUES (
    v_original_ledger.ambassador_id, v_original_ledger.store_id,
    v_original_ledger.source_channel, v_original_ledger.source_id,
    -v_original_ledger.gross_amount, v_original_ledger.commission_rate,
    -v_original_ledger.commission_amount, v_original_ledger.commission_plan_id,
    'reversed', NOW(), v_original_ledger.id
  );

  UPDATE commission_ledger SET status = 'reversed' WHERE id = v_original_ledger.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_order_reversal ON public.store_orders;
CREATE TRIGGER trg_store_order_reversal
AFTER UPDATE OF status ON public.store_orders
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.create_store_order_reversal();

-- 6️⃣ REVERSAL TRIGGER FOR marketplace_orders
CREATE OR REPLACE FUNCTION public.create_wholesale_order_reversal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original_ledger RECORD;
BEGIN
  IF NEW.fulfillment_status NOT IN ('cancelled', 'refunded') THEN RETURN NEW; END IF;

  SELECT * INTO v_original_ledger FROM commission_ledger
  WHERE source_id = NEW.id AND source_channel = 'wholesale_order'
    AND status != 'reversed' AND reversal_of IS NULL
  LIMIT 1;

  IF v_original_ledger.id IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM commission_ledger WHERE reversal_of = v_original_ledger.id) THEN RETURN NEW; END IF;

  INSERT INTO commission_ledger (
    ambassador_id, store_id, source_channel, source_id,
    gross_amount, commission_rate, commission_amount,
    commission_plan_id, status, earned_at, reversal_of
  ) VALUES (
    v_original_ledger.ambassador_id, v_original_ledger.store_id,
    v_original_ledger.source_channel, v_original_ledger.source_id,
    -v_original_ledger.gross_amount, v_original_ledger.commission_rate,
    -v_original_ledger.commission_amount, v_original_ledger.commission_plan_id,
    'reversed', NOW(), v_original_ledger.id
  );

  UPDATE commission_ledger SET status = 'reversed' WHERE id = v_original_ledger.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wholesale_order_reversal ON public.marketplace_orders;
CREATE TRIGGER trg_wholesale_order_reversal
AFTER UPDATE OF fulfillment_status ON public.marketplace_orders
FOR EACH ROW WHEN (OLD.fulfillment_status IS DISTINCT FROM NEW.fulfillment_status)
EXECUTE FUNCTION public.create_wholesale_order_reversal();