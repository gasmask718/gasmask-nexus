
-- ============================================================
-- GDS: collection_accounts — soft-delete + recovery ledger RPC
-- ============================================================

-- 1. Add soft-delete columns
ALTER TABLE public.collection_accounts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS delete_reason text;

-- 2. RPC: soft_delete_collection_account
CREATE OR REPLACE FUNCTION public.soft_delete_collection_account(
  p_account_id uuid,
  p_reason text,
  p_source_ui text DEFAULT 'collection_accounts'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_record jsonb;
  v_is_owner boolean;
BEGIN
  -- Verify owner role
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = v_user_id AND role = 'owner'
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Only owners can delete collection accounts';
  END IF;

  -- Snapshot the full record
  SELECT to_jsonb(ca.*) INTO v_record
  FROM collection_accounts ca
  WHERE ca.id = p_account_id AND ca.deleted_at IS NULL;

  IF v_record IS NULL THEN
    RAISE EXCEPTION 'Collection account not found or already deleted';
  END IF;

  -- Write to recovery ledger
  INSERT INTO deletion_recovery_log (
    entity_type, entity_table, entity_id, entity_snapshot,
    deleted_by, deleted_at, delete_reason, source_ui
  ) VALUES (
    'collection_account', 'collection_accounts', p_account_id, v_record,
    v_user_id, now(), p_reason, p_source_ui
  );

  -- Soft delete
  UPDATE collection_accounts
  SET deleted_at = now(),
      deleted_by = v_user_id,
      delete_reason = p_reason
  WHERE id = p_account_id;
END;
$$;

-- 3. RPC: restore_deleted_collection_account
CREATE OR REPLACE FUNCTION public.restore_deleted_collection_account(
  p_account_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_owner boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = v_user_id AND role = 'owner'
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Only owners can restore collection accounts';
  END IF;

  -- Restore the record
  UPDATE collection_accounts
  SET deleted_at = NULL,
      deleted_by = NULL,
      delete_reason = NULL
  WHERE id = p_account_id AND deleted_at IS NOT NULL;

  -- Mark recovery log
  UPDATE deletion_recovery_log
  SET is_restored = true,
      restored_at = now(),
      restored_by = v_user_id
  WHERE entity_table = 'collection_accounts'
    AND entity_id = p_account_id
    AND is_restored = false;
END;
$$;
