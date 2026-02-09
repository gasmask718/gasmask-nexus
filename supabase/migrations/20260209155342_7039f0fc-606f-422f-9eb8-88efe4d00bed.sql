
-- ============================================
-- Dynasty OS: Governed Soft-Delete + Recovery Ledger
-- ============================================

-- 1. Add soft-delete columns to store_master
ALTER TABLE public.store_master
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delete_reason text DEFAULT NULL;

-- Index for fast filtering of non-deleted records
CREATE INDEX IF NOT EXISTS idx_store_master_deleted_at ON public.store_master (deleted_at) WHERE deleted_at IS NULL;

-- 2. Create the central deletion recovery ledger
CREATE TABLE public.deletion_recovery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_table text NOT NULL,
  entity_id uuid NOT NULL,
  entity_snapshot jsonb NOT NULL,
  deleted_by uuid NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  delete_reason text,
  source_ui text,
  is_restored boolean NOT NULL DEFAULT false,
  restored_at timestamptz,
  restored_by uuid
);

-- Enable RLS
ALTER TABLE public.deletion_recovery_log ENABLE ROW LEVEL SECURITY;

-- 3. RLS: Only owner can view/manage the recovery ledger
CREATE POLICY "Owner can view recovery log"
  ON public.deletion_recovery_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owner can insert recovery log"
  ON public.deletion_recovery_log
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owner can update recovery log"
  ON public.deletion_recovery_log
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

-- 4. RPC: Governed soft-delete for stores (owner-only, snapshot + ledger)
CREATE OR REPLACE FUNCTION public.soft_delete_store(
  p_store_id uuid,
  p_reason text,
  p_source_ui text DEFAULT 'store_profile'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_snapshot jsonb;
BEGIN
  -- Verify owner role
  IF NOT public.has_role(v_user_id, 'owner') THEN
    RAISE EXCEPTION 'Only the owner can delete stores';
  END IF;

  -- Verify store exists and not already deleted
  SELECT to_jsonb(s.*) INTO v_snapshot
  FROM store_master s
  WHERE s.id = p_store_id AND s.deleted_at IS NULL;

  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'Store not found or already deleted';
  END IF;

  -- Write snapshot to recovery ledger
  INSERT INTO deletion_recovery_log (
    entity_type, entity_table, entity_id, entity_snapshot,
    deleted_by, delete_reason, source_ui
  ) VALUES (
    'store', 'store_master', p_store_id, v_snapshot,
    v_user_id, p_reason, p_source_ui
  );

  -- Soft delete the store
  UPDATE store_master SET
    deleted_at = now(),
    deleted_by = v_user_id,
    delete_reason = p_reason
  WHERE id = p_store_id;
END;
$$;

-- 5. RPC: Restore a soft-deleted store (owner-only)
CREATE OR REPLACE FUNCTION public.restore_deleted_store(
  p_log_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_log record;
BEGIN
  -- Verify owner role
  IF NOT public.has_role(v_user_id, 'owner') THEN
    RAISE EXCEPTION 'Only the owner can restore stores';
  END IF;

  -- Get the log entry
  SELECT * INTO v_log
  FROM deletion_recovery_log
  WHERE id = p_log_id AND entity_table = 'store_master' AND is_restored = false;

  IF v_log IS NULL THEN
    RAISE EXCEPTION 'Recovery log entry not found or already restored';
  END IF;

  -- Restore the store
  UPDATE store_master SET
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL
  WHERE id = v_log.entity_id;

  -- Mark the log as restored
  UPDATE deletion_recovery_log SET
    is_restored = true,
    restored_at = now(),
    restored_by = v_user_id
  WHERE id = p_log_id;
END;
$$;
