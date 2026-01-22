-- =============================================
-- ADMIN GOVERNANCE LAYER (Authoritative)
-- Admins approve, machines calculate
-- Ledger remains immutable
-- =============================================

-- 1️⃣ ADMIN VISIBILITY VIEWS (Read-Only Projections)

-- Overview: Per-ambassador commission summary
CREATE OR REPLACE VIEW public.admin_commission_overview AS
SELECT 
  a.id AS ambassador_id,
  p.name AS ambassador_name,
  p.email AS ambassador_email,
  a.tier,
  COUNT(cl.id) FILTER (WHERE cl.status = 'pending') AS pending_count,
  COUNT(cl.id) FILTER (WHERE cl.status = 'approved') AS approved_count,
  COUNT(cl.id) FILTER (WHERE cl.status = 'paid') AS paid_count,
  COUNT(cl.id) FILTER (WHERE cl.status = 'reversed') AS reversed_count,
  COALESCE(SUM(cl.commission_amount) FILTER (WHERE cl.status = 'pending'), 0) AS pending_amount,
  COALESCE(SUM(cl.commission_amount) FILTER (WHERE cl.status = 'approved'), 0) AS approved_amount,
  COALESCE(SUM(cl.commission_amount) FILTER (WHERE cl.status = 'paid'), 0) AS paid_amount,
  MIN(cl.earned_at) AS first_earning,
  MAX(cl.earned_at) AS last_earning
FROM public.ambassadors a
JOIN public.profiles p ON a.user_id = p.id
LEFT JOIN public.commission_ledger cl ON cl.ambassador_id = a.id
GROUP BY a.id, p.name, p.email, a.tier;

-- Chronological ledger feed with ambassador/store details
CREATE OR REPLACE VIEW public.admin_ledger_feed AS
SELECT 
  cl.id,
  cl.ambassador_id,
  p.name AS ambassador_name,
  cl.store_id,
  sm.store_name,
  cl.source_channel,
  cl.source_id,
  cl.gross_amount,
  cl.commission_rate,
  cl.commission_amount,
  cl.status,
  cl.earned_at,
  cl.approved_at,
  cl.paid_at,
  cl.reversal_of,
  cp.name AS plan_name,
  cl.created_at
FROM public.commission_ledger cl
JOIN public.ambassadors a ON cl.ambassador_id = a.id
JOIN public.profiles p ON a.user_id = p.id
LEFT JOIN public.store_master sm ON cl.store_id = sm.id
LEFT JOIN public.commission_plans cp ON cl.commission_plan_id = cp.id
ORDER BY cl.earned_at DESC;

-- 2️⃣ SAFE APPROVAL FUNCTION (Status Only, No Amount Changes)
CREATE OR REPLACE FUNCTION public.admin_approve_commission(
  p_ledger_id uuid,
  p_admin_user_id uuid DEFAULT NULL
)
RETURNS TABLE(success boolean, message text, affected_rows int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affected int;
BEGIN
  -- Verify caller is elevated
  IF NOT public.is_elevated_user() THEN
    RETURN QUERY SELECT false, 'Unauthorized: Admin access required'::text, 0;
    RETURN;
  END IF;

  -- Safe transition: pending → approved only
  UPDATE commission_ledger
  SET status = 'approved', approved_at = NOW()
  WHERE id = p_ledger_id AND status = 'pending';
  
  GET DIAGNOSTICS v_affected = ROW_COUNT;

  IF v_affected = 0 THEN
    RETURN QUERY SELECT false, 'No pending commission found with this ID'::text, 0;
  ELSE
    -- Audit log
    INSERT INTO entity_audit_log (entity_type, entity_id, field_changed, old_value, new_value, changed_by)
    VALUES ('commission_ledger', p_ledger_id, 'status', 'pending', 'approved', COALESCE(p_admin_user_id, auth.uid()));
    
    RETURN QUERY SELECT true, 'Commission approved successfully'::text, v_affected;
  END IF;
END;
$$;

-- 3️⃣ BULK APPROVAL FUNCTION
CREATE OR REPLACE FUNCTION public.admin_bulk_approve_commissions(
  p_ledger_ids uuid[],
  p_admin_user_id uuid DEFAULT NULL
)
RETURNS TABLE(success boolean, message text, affected_rows int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affected int;
BEGIN
  IF NOT public.is_elevated_user() THEN
    RETURN QUERY SELECT false, 'Unauthorized: Admin access required'::text, 0;
    RETURN;
  END IF;

  UPDATE commission_ledger
  SET status = 'approved', approved_at = NOW()
  WHERE id = ANY(p_ledger_ids) AND status = 'pending';
  
  GET DIAGNOSTICS v_affected = ROW_COUNT;

  -- Bulk audit
  INSERT INTO entity_audit_log (entity_type, entity_id, field_changed, old_value, new_value, changed_by)
  SELECT 'commission_ledger', unnest(p_ledger_ids), 'status', 'pending', 'approved', COALESCE(p_admin_user_id, auth.uid());

  RETURN QUERY SELECT true, format('%s commissions approved', v_affected)::text, v_affected;
END;
$$;

-- 4️⃣ SAFE REVERSAL FUNCTION (Creates New Row, Never Edits)
CREATE OR REPLACE FUNCTION public.admin_create_reversal(
  p_ledger_id uuid,
  p_reason text DEFAULT 'Admin reversal',
  p_admin_user_id uuid DEFAULT NULL
)
RETURNS TABLE(success boolean, message text, reversal_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original RECORD;
  v_new_id uuid;
BEGIN
  IF NOT public.is_elevated_user() THEN
    RETURN QUERY SELECT false, 'Unauthorized: Admin access required'::text, NULL::uuid;
    RETURN;
  END IF;

  -- Get original entry
  SELECT * INTO v_original FROM commission_ledger
  WHERE id = p_ledger_id AND status IN ('pending', 'approved') AND reversal_of IS NULL;

  IF v_original.id IS NULL THEN
    RETURN QUERY SELECT false, 'Cannot reverse: Entry not found or already reversed'::text, NULL::uuid;
    RETURN;
  END IF;

  -- Check if already reversed
  IF EXISTS (SELECT 1 FROM commission_ledger WHERE reversal_of = p_ledger_id) THEN
    RETURN QUERY SELECT false, 'This commission has already been reversed'::text, NULL::uuid;
    RETURN;
  END IF;

  -- Create reversal entry (negative amounts)
  INSERT INTO commission_ledger (
    ambassador_id, store_id, source_channel, source_id,
    gross_amount, commission_rate, commission_amount,
    commission_plan_id, status, earned_at, reversal_of
  ) VALUES (
    v_original.ambassador_id, v_original.store_id,
    v_original.source_channel, v_original.source_id,
    -v_original.gross_amount, v_original.commission_rate,
    -v_original.commission_amount, v_original.commission_plan_id,
    'reversed', NOW(), v_original.id
  ) RETURNING id INTO v_new_id;

  -- Mark original as reversed
  UPDATE commission_ledger SET status = 'reversed' WHERE id = p_ledger_id;

  -- Audit trail
  INSERT INTO entity_audit_log (entity_type, entity_id, field_changed, old_value, new_value, changed_by, notes)
  VALUES ('commission_ledger', p_ledger_id, 'status', v_original.status, 'reversed', 
          COALESCE(p_admin_user_id, auth.uid()), p_reason);

  RETURN QUERY SELECT true, 'Reversal created successfully'::text, v_new_id;
END;
$$;

-- 5️⃣ PLAN ACTIVATION (Safe Forward-Only)
CREATE OR REPLACE FUNCTION public.admin_activate_plan(
  p_plan_id uuid,
  p_admin_user_id uuid DEFAULT NULL
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan RECORD;
BEGIN
  IF NOT public.is_elevated_user() THEN
    RETURN QUERY SELECT false, 'Unauthorized: Admin access required'::text;
    RETURN;
  END IF;

  SELECT * INTO v_plan FROM commission_plans WHERE id = p_plan_id;
  
  IF v_plan.id IS NULL THEN
    RETURN QUERY SELECT false, 'Plan not found'::text;
    RETURN;
  END IF;

  -- Deactivate other plans of same type
  UPDATE commission_plans 
  SET active = false, updated_at = NOW()
  WHERE applies_to = v_plan.applies_to AND id != p_plan_id AND active = true;

  -- Activate the target plan
  UPDATE commission_plans 
  SET active = true, updated_at = NOW()
  WHERE id = p_plan_id;

  -- Audit
  INSERT INTO entity_audit_log (entity_type, entity_id, field_changed, old_value, new_value, changed_by)
  VALUES ('commission_plans', p_plan_id, 'active', 'false', 'true', COALESCE(p_admin_user_id, auth.uid()));

  RETURN QUERY SELECT true, format('Plan "%s" activated', v_plan.name)::text;
END;
$$;

-- 6️⃣ PAYOUT SUMMARY VIEW
CREATE OR REPLACE VIEW public.admin_payout_summary AS
SELECT 
  a.id AS ambassador_id,
  p.name AS ambassador_name,
  COALESCE(SUM(cl.commission_amount) FILTER (WHERE cl.status = 'approved'), 0) AS approved_unpaid,
  COALESCE(SUM(cl.commission_amount) FILTER (WHERE cl.status = 'paid'), 0) AS total_paid,
  COUNT(cl.id) FILTER (WHERE cl.status = 'approved') AS pending_payout_count,
  (SELECT MAX(cpb.paid_at) FROM commission_payout_batches cpb WHERE cpb.ambassador_id = a.id) AS last_payout_date
FROM public.ambassadors a
JOIN public.profiles p ON a.user_id = p.id
LEFT JOIN public.commission_ledger cl ON cl.ambassador_id = a.id
GROUP BY a.id, p.name;

-- 7️⃣ GRANT FUNCTIONS TO AUTHENTICATED (RLS handles actual access)
GRANT EXECUTE ON FUNCTION public.admin_approve_commission TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_bulk_approve_commissions TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_reversal TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_activate_plan TO authenticated;