-- ============================================================
-- FIELD GOVERNANCE DATABASE GUARDRAILS
-- Phase 1: Database-level protection for field mutations
-- ============================================================

-- 1. Create a function to check if a role is a field role
CREATE OR REPLACE FUNCTION public.is_field_role(p_role text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_role IN ('driver', 'biker', 'ambassador');
$$;

-- 2. Create a function to get the current user's role
-- Uses the profiles table to look up role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT COALESCE(p.role, p.primary_role) INTO v_role
  FROM public.profiles p
  WHERE p.id = auth.uid();
  
  RETURN COALESCE(v_role, 'unknown');
END;
$$;

-- 3. Create a trigger function that blocks direct field role writes
-- This will be attached to tables that MUST go through governance
CREATE OR REPLACE FUNCTION public.block_direct_field_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_bypass_key text;
BEGIN
  -- Get the current user's role
  v_role := public.get_current_user_role();
  
  -- Check if this is a field role
  IF public.is_field_role(v_role) THEN
    -- Check for governance bypass key (set when mutations come through governance)
    v_bypass_key := current_setting('app.governance_bypass', true);
    
    IF v_bypass_key IS NULL OR v_bypass_key != 'authorized' THEN
      RAISE EXCEPTION 'GOVERNANCE VIOLATION: Direct mutation blocked — governance submission required. Role: %, Table: %, Operation: %',
        v_role, TG_TABLE_NAME, TG_OP;
    END IF;
  END IF;
  
  -- Allow the operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- 4. Create a function to set the governance bypass flag
-- This will be called by the application when mutations are governed
CREATE OR REPLACE FUNCTION public.set_governance_bypass(p_authorized boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_authorized THEN
    PERFORM set_config('app.governance_bypass', 'authorized', true);
  ELSE
    PERFORM set_config('app.governance_bypass', '', true);
  END IF;
END;
$$;

-- 5. Apply the trigger to high-risk tables that field roles can modify
-- Starting with brand stickers and tube inventory

-- Note: We're NOT enabling strict blocking yet - this is Phase 1 (audit mode)
-- Uncomment these to enable strict blocking in Phase 2:

/*
DROP TRIGGER IF EXISTS trg_block_direct_field_writes ON public.store_brand_stickers;
CREATE TRIGGER trg_block_direct_field_writes
  BEFORE INSERT OR UPDATE OR DELETE ON public.store_brand_stickers
  FOR EACH ROW
  EXECUTE FUNCTION public.block_direct_field_writes();

DROP TRIGGER IF EXISTS trg_block_direct_field_writes ON public.store_tube_inventory_status;
CREATE TRIGGER trg_block_direct_field_writes
  BEFORE INSERT OR UPDATE OR DELETE ON public.store_tube_inventory_status
  FOR EACH ROW
  EXECUTE FUNCTION public.block_direct_field_writes();
*/

-- 6. Create audit function to log governance violations (soft mode)
CREATE OR REPLACE FUNCTION public.log_field_governance_event(
  p_table_name text,
  p_operation text,
  p_role text,
  p_user_id uuid,
  p_bypassed boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.portal_audit_log (
    user_id,
    action,
    resource_type,
    details,
    created_at
  ) VALUES (
    p_user_id,
    CASE WHEN p_bypassed THEN 'GOVERNANCE_BYPASS' ELSE 'GOVERNANCE_COMPLIANT' END,
    p_table_name,
    jsonb_build_object(
      'operation', p_operation,
      'role', p_role,
      'bypassed', p_bypassed,
      'timestamp', now()
    ),
    now()
  );
END;
$$;

-- 7. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_field_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_governance_bypass(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_field_governance_event(text, text, text, uuid, boolean) TO authenticated;