
-- Enable pgcrypto for hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- AUDIT_LOG: Add missing columns to existing table
-- ============================================
ALTER TABLE audit_log 
ADD COLUMN IF NOT EXISTS actor_user_id uuid,
ADD COLUMN IF NOT EXISTS actor_role text,
ADD COLUMN IF NOT EXISTS actor_ip inet,
ADD COLUMN IF NOT EXISTS user_agent text,
ADD COLUMN IF NOT EXISTS before jsonb,
ADD COLUMN IF NOT EXISTS after jsonb,
ADD COLUMN IF NOT EXISTS changed_fields text[],
ADD COLUMN IF NOT EXISTS request_id text,
ADD COLUMN IF NOT EXISTS source text DEFAULT 'trigger',
ADD COLUMN IF NOT EXISTS row_hash text,
ADD COLUMN IF NOT EXISTS prev_row_hash text,
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Migrate old data to new columns
UPDATE audit_log SET 
  actor_user_id = acted_by,
  before = old_data,
  after = new_data,
  created_at = acted_at
WHERE created_at IS NULL AND acted_at IS NOT NULL;

-- Set default row_hash for existing rows
UPDATE audit_log SET row_hash = encode(digest(id::text || coalesce(table_name,''), 'sha256'), 'hex')
WHERE row_hash IS NULL;

-- Make row_hash NOT NULL after populating
ALTER TABLE audit_log ALTER COLUMN row_hash SET NOT NULL;

-- Add action check constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'audit_log_action_check'
  ) THEN
    -- Only add if there are no invalid actions
    IF NOT EXISTS (
      SELECT 1 FROM audit_log WHERE action NOT IN ('INSERT','UPDATE','DELETE') AND action IS NOT NULL
    ) THEN
      ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check 
        CHECK (action IN ('INSERT','UPDATE','DELETE'));
    END IF;
  END IF;
END $$;

-- Create indexes if not exist
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(table_name, record_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_user_id, created_at DESC);

-- ============================================
-- AUDIT_LOCK: Freeze money tables
-- ============================================
CREATE TABLE IF NOT EXISTS audit_lock (
  table_name text PRIMARY KEY,
  locked boolean NOT NULL DEFAULT true,
  locked_at timestamptz NOT NULL DEFAULT now(),
  locked_by uuid
);

INSERT INTO audit_lock(table_name, locked)
VALUES
  ('commission_ledger', true),
  ('payout_batch_items', true),
  ('payout_batches', true)
ON CONFLICT (table_name) DO NOTHING;

-- ============================================
-- HELPER: Compute hash for chain
-- ============================================
CREATE OR REPLACE FUNCTION audit_compute_hash(prev text, payload jsonb)
RETURNS text 
LANGUAGE sql 
IMMUTABLE 
AS $$
  SELECT encode(digest(coalesce(prev,'') || coalesce(payload::text,''), 'sha256'), 'hex');
$$;

-- ============================================
-- HELPER: Get current actor role
-- ============================================
CREATE OR REPLACE FUNCTION audit_actor_role()
RETURNS text 
LANGUAGE plpgsql 
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role::text INTO v_role
  FROM user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  IF v_role IS NOT NULL THEN
    RETURN v_role;
  END IF;
  
  IF EXISTS (SELECT 1 FROM ambassadors WHERE user_id = auth.uid()) THEN
    RETURN 'ambassador';
  END IF;
  
  RETURN 'user';
END;
$$;

-- ============================================
-- CORE: Write audit log entry with hash chain
-- ============================================
CREATE OR REPLACE FUNCTION audit_write(
  p_table text,
  p_record uuid,
  p_action text,
  p_before jsonb,
  p_after jsonb,
  p_changed_fields text[],
  p_request_id text DEFAULT NULL,
  p_source text DEFAULT 'trigger'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev text;
  v_payload jsonb;
  v_hash text;
BEGIN
  SELECT row_hash INTO v_prev
  FROM audit_log
  WHERE table_name = p_table
  ORDER BY created_at DESC
  LIMIT 1;

  v_payload := jsonb_build_object(
    'table', p_table,
    'record_id', p_record,
    'action', p_action,
    'before', p_before,
    'after', p_after,
    'changed_fields', p_changed_fields,
    'request_id', p_request_id,
    'source', p_source,
    'actor_user_id', auth.uid(),
    'actor_role', audit_actor_role(),
    'at', now()
  );

  v_hash := audit_compute_hash(v_prev, v_payload);

  INSERT INTO audit_log(
    table_name, record_id, action,
    actor_user_id, actor_role,
    before, after, changed_fields,
    request_id, source,
    prev_row_hash, row_hash, created_at
  )
  VALUES (
    p_table, p_record, p_action,
    auth.uid(), audit_actor_role(),
    p_before, p_after, p_changed_fields,
    p_request_id, p_source,
    v_prev, v_hash, now()
  );
END;
$$;

-- ============================================
-- TRIGGER: Generic audit for operational tables
-- ============================================
CREATE OR REPLACE FUNCTION trg_audit_generic()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_changed text[];
  v_record_id uuid;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_before := NULL;
    v_after  := to_jsonb(NEW);
    v_changed := NULL;
    v_record_id := NEW.id;
    PERFORM audit_write(TG_TABLE_NAME, v_record_id, 'INSERT', v_before, v_after, v_changed);
    RETURN NEW;

  ELSIF (TG_OP = 'UPDATE') THEN
    v_before := to_jsonb(OLD);
    v_after  := to_jsonb(NEW);
    v_record_id := NEW.id;
    SELECT array_agg(key) INTO v_changed
    FROM (
      SELECT key FROM jsonb_each(v_before)
      WHERE (v_after -> key) IS DISTINCT FROM (v_before -> key)
    ) s;
    PERFORM audit_write(TG_TABLE_NAME, v_record_id, 'UPDATE', v_before, v_after, v_changed);
    RETURN NEW;

  ELSIF (TG_OP = 'DELETE') THEN
    v_before := to_jsonb(OLD);
    v_after  := NULL;
    v_record_id := OLD.id;
    PERFORM audit_write(TG_TABLE_NAME, v_record_id, 'DELETE', v_before, v_after, NULL);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- ============================================
-- TRIGGER: Block mutations on locked tables
-- ============================================
CREATE OR REPLACE FUNCTION trg_block_mutation_if_locked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked boolean;
BEGIN
  SELECT locked INTO v_locked
  FROM audit_lock
  WHERE table_name = TG_TABLE_NAME;

  IF coalesce(v_locked, false) = true THEN
    RAISE EXCEPTION 'AUDIT_LOCK: % is immutable. Use reversal workflow.', TG_TABLE_NAME;
  END IF;

  RETURN coalesce(NEW, OLD);
END;
$$;

-- ============================================
-- ATTACH AUDIT TRIGGERS TO OPERATIONAL TABLES
-- ============================================
DROP TRIGGER IF EXISTS audit_store_master ON store_master;
CREATE TRIGGER audit_store_master
AFTER INSERT OR UPDATE OR DELETE ON store_master
FOR EACH ROW EXECUTE FUNCTION trg_audit_generic();

DROP TRIGGER IF EXISTS audit_ambassador_assignments ON ambassador_assignments;
CREATE TRIGGER audit_ambassador_assignments
AFTER INSERT OR UPDATE OR DELETE ON ambassador_assignments
FOR EACH ROW EXECUTE FUNCTION trg_audit_generic();

DROP TRIGGER IF EXISTS audit_disputes ON commission_disputes;
CREATE TRIGGER audit_disputes
AFTER INSERT OR UPDATE OR DELETE ON commission_disputes
FOR EACH ROW EXECUTE FUNCTION trg_audit_generic();

DROP TRIGGER IF EXISTS audit_ambassadors ON ambassadors;
CREATE TRIGGER audit_ambassadors
AFTER INSERT OR UPDATE OR DELETE ON ambassadors
FOR EACH ROW EXECUTE FUNCTION trg_audit_generic();

-- ============================================
-- ATTACH IMMUTABILITY TRIGGERS TO MONEY TABLES
-- ============================================
DROP TRIGGER IF EXISTS block_commission_ledger_mutations ON commission_ledger;
CREATE TRIGGER block_commission_ledger_mutations
BEFORE UPDATE OR DELETE ON commission_ledger
FOR EACH ROW EXECUTE FUNCTION trg_block_mutation_if_locked();

DROP TRIGGER IF EXISTS block_payout_batches_mutations ON payout_batches;
CREATE TRIGGER block_payout_batches_mutations
BEFORE UPDATE OR DELETE ON payout_batches
FOR EACH ROW EXECUTE FUNCTION trg_block_mutation_if_locked();

DROP TRIGGER IF EXISTS block_payout_items_mutations ON payout_batch_items;
CREATE TRIGGER block_payout_items_mutations
BEFORE UPDATE OR DELETE ON payout_batch_items
FOR EACH ROW EXECUTE FUNCTION trg_block_mutation_if_locked();

-- ============================================
-- REVERSAL COLUMNS
-- ============================================
ALTER TABLE commission_ledger
ADD COLUMN IF NOT EXISTS reversed_ledger_id uuid,
ADD COLUMN IF NOT EXISTS reversal_reason text,
ADD COLUMN IF NOT EXISTS reversal_of uuid;

-- ============================================
-- VIEW: Hash chain integrity check
-- ============================================
CREATE OR REPLACE VIEW v_audit_integrity_check AS
WITH ordered AS (
  SELECT
    al.id,
    al.table_name,
    al.created_at,
    al.prev_row_hash,
    al.row_hash,
    lag(al.row_hash) OVER (PARTITION BY al.table_name ORDER BY al.created_at) AS expected_prev
  FROM audit_log al
)
SELECT
  table_name,
  count(*) AS rows_checked,
  count(*) FILTER (WHERE expected_prev IS DISTINCT FROM prev_row_hash AND expected_prev IS NOT NULL) AS broken_links
FROM ordered
GROUP BY table_name;

-- ============================================
-- RLS: Protect audit_log
-- ============================================
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_lock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_admin_read ON audit_log;
CREATE POLICY audit_log_admin_read ON audit_log
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

DROP POLICY IF EXISTS audit_log_no_insert ON audit_log;
CREATE POLICY audit_log_no_insert ON audit_log
FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS audit_log_no_update ON audit_log;
CREATE POLICY audit_log_no_update ON audit_log
FOR UPDATE USING (false);

DROP POLICY IF EXISTS audit_log_no_delete ON audit_log;
CREATE POLICY audit_log_no_delete ON audit_log
FOR DELETE USING (false);

DROP POLICY IF EXISTS audit_lock_admin ON audit_lock;
CREATE POLICY audit_lock_admin ON audit_lock
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

-- ============================================
-- RPC: Get audit trail for a record
-- ============================================
CREATE OR REPLACE FUNCTION get_audit_trail(
  p_table_name text,
  p_record_id uuid
)
RETURNS TABLE (
  id uuid,
  action text,
  actor_user_id uuid,
  actor_role text,
  before jsonb,
  after jsonb,
  changed_fields text[],
  source text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT 
    al.id,
    al.action,
    al.actor_user_id,
    al.actor_role,
    al.before,
    al.after,
    al.changed_fields,
    al.source,
    al.created_at
  FROM audit_log al
  WHERE al.table_name = p_table_name
    AND al.record_id = p_record_id
  ORDER BY al.created_at DESC;
END;
$$;

-- ============================================
-- RPC: Search audit logs
-- ============================================
CREATE OR REPLACE FUNCTION search_audit_logs(
  p_table_name text DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_actor_role text DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  table_name text,
  record_id uuid,
  action text,
  actor_user_id uuid,
  actor_role text,
  changed_fields text[],
  source text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT 
    al.id,
    al.table_name,
    al.record_id,
    al.action,
    al.actor_user_id,
    al.actor_role,
    al.changed_fields,
    al.source,
    al.created_at
  FROM audit_log al
  WHERE (p_table_name IS NULL OR al.table_name = p_table_name)
    AND (p_action IS NULL OR al.action = p_action)
    AND (p_actor_role IS NULL OR al.actor_role = p_actor_role)
    AND (p_actor_user_id IS NULL OR al.actor_user_id = p_actor_user_id)
    AND (p_start_date IS NULL OR al.created_at >= p_start_date)
    AND (p_end_date IS NULL OR al.created_at <= p_end_date)
  ORDER BY al.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ============================================
-- RPC: Get integrity check summary
-- ============================================
CREATE OR REPLACE FUNCTION get_audit_integrity()
RETURNS TABLE (
  table_name text,
  rows_checked bigint,
  broken_links bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY SELECT * FROM v_audit_integrity_check;
END;
$$;
