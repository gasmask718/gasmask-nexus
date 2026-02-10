
-- ============================================================
-- FLOOR 1 — STORE PROMOTION GATE
-- Controlled, auditable bridge from territory intelligence to CRM.
-- No store may enter CRM without passing through this gate.
-- ============================================================

-- 1) territory_store_promotions
-- Each row = one promotion request from territory → CRM.
-- Status lifecycle: pending → approved | rejected
CREATE TABLE public.territory_store_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_address_id UUID NOT NULL REFERENCES public.territory_addresses(id),
  candidate_id UUID REFERENCES public.territory_store_candidates(id),
  proposed_store_name TEXT NOT NULL,
  proposed_contact_name TEXT,
  proposed_phone TEXT,
  verified_sells_tobacco BOOLEAN DEFAULT false,
  verified_sells_grabba BOOLEAN DEFAULT false,
  verification_method TEXT NOT NULL CHECK (verification_method IN ('visit', 'call', 'wholesaler_confirmation')),
  requested_by UUID NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  promoted_store_id UUID, -- FK to store_master after approval
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: all authenticated can read, all can request, only owner/admin approve/reject
ALTER TABLE public.territory_store_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read promotions"
  ON public.territory_store_promotions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can request promotions"
  ON public.territory_store_promotions FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Only management can update promotions"
  ON public.territory_store_promotions FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('owner', 'admin')
    )
  );

-- Timestamp trigger
CREATE TRIGGER update_territory_store_promotions_updated_at
  BEFORE UPDATE ON public.territory_store_promotions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RPC: request_store_promotion
-- Any authenticated user can submit a pending promotion request.
-- Logs the action in territory_activity_log.
-- ============================================================
CREATE OR REPLACE FUNCTION public.request_store_promotion(
  p_territory_address_id UUID,
  p_candidate_id UUID DEFAULT NULL,
  p_proposed_store_name TEXT DEFAULT '',
  p_proposed_contact_name TEXT DEFAULT NULL,
  p_proposed_phone TEXT DEFAULT NULL,
  p_verified_sells_tobacco BOOLEAN DEFAULT false,
  p_verified_sells_grabba BOOLEAN DEFAULT false,
  p_verification_method TEXT DEFAULT 'visit'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promotion_id UUID;
  v_user_id UUID := auth.uid();
BEGIN
  -- Guard: must be authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Guard: address must exist
  IF NOT EXISTS (SELECT 1 FROM territory_addresses WHERE id = p_territory_address_id) THEN
    RAISE EXCEPTION 'Territory address not found';
  END IF;

  -- Guard: no duplicate pending promotion for same address
  IF EXISTS (
    SELECT 1 FROM territory_store_promotions
    WHERE territory_address_id = p_territory_address_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'A pending promotion already exists for this address';
  END IF;

  -- Create promotion request
  INSERT INTO territory_store_promotions (
    territory_address_id, candidate_id, proposed_store_name,
    proposed_contact_name, proposed_phone,
    verified_sells_tobacco, verified_sells_grabba,
    verification_method, requested_by
  ) VALUES (
    p_territory_address_id, p_candidate_id, p_proposed_store_name,
    p_proposed_contact_name, p_proposed_phone,
    p_verified_sells_tobacco, p_verified_sells_grabba,
    p_verification_method, v_user_id
  ) RETURNING id INTO v_promotion_id;

  -- Audit log
  INSERT INTO territory_activity_log (
    territory_address_id, action_type, actor_type, actor_id, notes
  ) VALUES (
    p_territory_address_id, 'promotion_requested', 'human', v_user_id,
    'Promotion requested: ' || p_proposed_store_name
  );

  RETURN v_promotion_id;
END;
$$;

-- ============================================================
-- RPC: approve_store_promotion
-- ONLY owner/admin. Atomically creates CRM store, links territory,
-- updates address status, and marks promotion approved.
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_store_promotion(
  p_promotion_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_role TEXT;
  v_promo RECORD;
  v_store_id UUID;
  v_address RECORD;
BEGIN
  -- Guard: must be authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Guard: must be owner or admin
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only owner or admin can approve promotions';
  END IF;

  -- Load promotion
  SELECT * INTO v_promo FROM territory_store_promotions WHERE id = p_promotion_id;
  IF v_promo IS NULL THEN
    RAISE EXCEPTION 'Promotion not found';
  END IF;
  IF v_promo.status != 'pending' THEN
    RAISE EXCEPTION 'Promotion is not pending (current: %)', v_promo.status;
  END IF;

  -- Load address for location data
  SELECT * INTO v_address FROM territory_addresses WHERE id = v_promo.territory_address_id;

  -- Create real CRM store in store_master
  INSERT INTO store_master (
    name, address, city, state, zip,
    latitude, longitude,
    territory_address_id,
    created_at
  ) VALUES (
    v_promo.proposed_store_name,
    v_address.full_address,
    v_address.city,
    v_address.state,
    v_address.zip,
    v_address.latitude,
    v_address.longitude,
    v_promo.territory_address_id,
    now()
  ) RETURNING id INTO v_store_id;

  -- Update address discovery status
  UPDATE territory_addresses
  SET discovery_status = 'verified_store',
      verified_sells_grabba = v_promo.verified_sells_grabba,
      last_checked_at = now()
  WHERE id = v_promo.territory_address_id;

  -- Mark promotion approved
  UPDATE territory_store_promotions
  SET status = 'approved',
      verified_by = v_user_id,
      verified_at = now(),
      promoted_store_id = v_store_id
  WHERE id = p_promotion_id;

  -- Audit log
  INSERT INTO territory_activity_log (
    territory_address_id, action_type, actor_type, actor_id, notes
  ) VALUES (
    v_promo.territory_address_id, 'verified', 'human', v_user_id,
    'Promotion approved → store_master ID: ' || v_store_id::text
  );

  RETURN v_store_id;
END;
$$;

-- ============================================================
-- RPC: reject_store_promotion
-- ONLY owner/admin. Marks promotion rejected with reason.
-- ============================================================
CREATE OR REPLACE FUNCTION public.reject_store_promotion(
  p_promotion_id UUID,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_role TEXT;
  v_promo RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only owner or admin can reject promotions';
  END IF;

  SELECT * INTO v_promo FROM territory_store_promotions WHERE id = p_promotion_id;
  IF v_promo IS NULL THEN
    RAISE EXCEPTION 'Promotion not found';
  END IF;
  IF v_promo.status != 'pending' THEN
    RAISE EXCEPTION 'Promotion is not pending';
  END IF;

  -- Mark rejected
  UPDATE territory_store_promotions
  SET status = 'rejected',
      verified_by = v_user_id,
      verified_at = now(),
      rejection_reason = p_rejection_reason
  WHERE id = p_promotion_id;

  -- Update address status based on reason
  UPDATE territory_addresses
  SET discovery_status = 'not_interested',
      last_checked_at = now()
  WHERE id = v_promo.territory_address_id;

  -- Audit log
  INSERT INTO territory_activity_log (
    territory_address_id, action_type, actor_type, actor_id,
    notes
  ) VALUES (
    v_promo.territory_address_id, 'rejected', 'human', v_user_id,
    'Promotion rejected: ' || COALESCE(p_rejection_reason, 'No reason given')
  );
END;
$$;
