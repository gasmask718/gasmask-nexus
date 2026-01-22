-- =====================================================
-- COMMISSION DISPUTES ENGINE - Phase 2C
-- Full dispute lifecycle: submit → review → resolve
-- =====================================================

-- 1️⃣ CREATE ENUM FOR DISPUTE STATUS
DO $$ BEGIN
  CREATE TYPE commission_dispute_status AS ENUM (
    'submitted',     -- ambassador filed
    'under_review',  -- admin picked up
    'needs_info',    -- waiting on ambassador
    'approved',      -- dispute approved (will create adjustment)
    'rejected',      -- dispute rejected
    'resolved'       -- adjustment posted + linked (final)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2️⃣ MAIN DISPUTES TABLE
CREATE TABLE IF NOT EXISTS public.commission_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  ambassador_id uuid NOT NULL REFERENCES public.ambassadors(id) ON DELETE RESTRICT,
  commission_ledger_id uuid REFERENCES public.commission_ledger(id) ON DELETE RESTRICT,
  
  -- optional context when not tied to a specific ledger row
  store_id uuid REFERENCES public.store_master(id) ON DELETE SET NULL,
  source_channel text,
  source_id text,
  
  reason_code text NOT NULL CHECK (reason_code IN (
    'missing_commission', 'wrong_rate', 'wrong_amount', 'duplicate', 'refund', 'other'
  )),
  title text,
  description text NOT NULL,
  
  requested_amount numeric(12,2),
  currency text NOT NULL DEFAULT 'USD',
  
  status commission_dispute_status NOT NULL DEFAULT 'submitted',
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- admin handling
  assigned_admin_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_notes text,
  resolution_summary text,
  
  -- linkage to the adjustment once approved
  adjustment_ledger_id uuid REFERENCES public.commission_ledger(id) ON DELETE SET NULL,
  
  -- soft close timestamps
  reviewed_at timestamptz,
  resolved_at timestamptz
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_disputes_ambassador ON public.commission_disputes(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.commission_disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_ledger ON public.commission_disputes(commission_ledger_id);

-- 3️⃣ EVIDENCE ATTACHMENTS TABLE
CREATE TABLE IF NOT EXISTS public.commission_dispute_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL REFERENCES public.commission_disputes(id) ON DELETE CASCADE,
  uploaded_by_ambassador_id uuid REFERENCES public.ambassadors(id) ON DELETE SET NULL,
  file_url text NOT NULL,
  file_name text,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_dispute ON public.commission_dispute_evidence(dispute_id);

-- 4️⃣ DISPUTE MESSAGES TABLE (threaded conversation)
CREATE TABLE IF NOT EXISTS public.commission_dispute_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL REFERENCES public.commission_disputes(id) ON DELETE CASCADE,
  
  author_role text NOT NULL CHECK (author_role IN ('ambassador', 'admin')),
  author_ambassador_id uuid REFERENCES public.ambassadors(id) ON DELETE SET NULL,
  author_admin_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_dispute ON public.commission_dispute_messages(dispute_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE public.commission_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_dispute_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_dispute_messages ENABLE ROW LEVEL SECURITY;

-- DISPUTES POLICIES
CREATE POLICY "ambassador_select_own_disputes"
ON public.commission_disputes FOR SELECT
USING (
  ambassador_id = current_ambassador_id()
  OR is_elevated_user()
);

CREATE POLICY "ambassador_insert_own_disputes"
ON public.commission_disputes FOR INSERT
WITH CHECK (
  ambassador_id = current_ambassador_id()
);

CREATE POLICY "ambassador_update_own_submitted_or_needs_info"
ON public.commission_disputes FOR UPDATE
USING (
  ambassador_id = current_ambassador_id()
  AND status::text IN ('submitted', 'needs_info')
)
WITH CHECK (
  ambassador_id = current_ambassador_id()
  AND status::text IN ('submitted', 'needs_info')
);

CREATE POLICY "admin_full_access_disputes"
ON public.commission_disputes FOR ALL
USING (is_elevated_user())
WITH CHECK (is_elevated_user());

-- EVIDENCE POLICIES
CREATE POLICY "evidence_select"
ON public.commission_dispute_evidence FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.commission_disputes d
    WHERE d.id = dispute_id
      AND (d.ambassador_id = current_ambassador_id() OR is_elevated_user())
  )
);

CREATE POLICY "ambassador_insert_evidence"
ON public.commission_dispute_evidence FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.commission_disputes d
    WHERE d.id = dispute_id
      AND d.ambassador_id = current_ambassador_id()
  )
);

CREATE POLICY "admin_full_access_evidence"
ON public.commission_dispute_evidence FOR ALL
USING (is_elevated_user())
WITH CHECK (is_elevated_user());

-- MESSAGES POLICIES
CREATE POLICY "messages_select"
ON public.commission_dispute_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.commission_disputes d
    WHERE d.id = dispute_id
      AND (d.ambassador_id = current_ambassador_id() OR is_elevated_user())
  )
);

CREATE POLICY "ambassador_insert_message"
ON public.commission_dispute_messages FOR INSERT
WITH CHECK (
  author_role = 'ambassador'
  AND author_ambassador_id = current_ambassador_id()
  AND EXISTS (
    SELECT 1 FROM public.commission_disputes d
    WHERE d.id = dispute_id AND d.ambassador_id = current_ambassador_id()
  )
);

CREATE POLICY "admin_insert_message"
ON public.commission_dispute_messages FOR INSERT
WITH CHECK (
  is_elevated_user()
  AND author_role = 'admin'
  AND author_admin_user_id = auth.uid()
);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- A) Auto updated_at
DROP TRIGGER IF EXISTS trg_disputes_updated_at ON public.commission_disputes;
CREATE TRIGGER trg_disputes_updated_at
BEFORE UPDATE ON public.commission_disputes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- B) Prevent edits after final status
CREATE OR REPLACE FUNCTION public.prevent_dispute_edit_after_final()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status::text IN ('approved', 'rejected', 'resolved') THEN
    -- Allow only status changes to 'resolved' from approved/rejected
    IF NEW.status::text = 'resolved' AND OLD.status::text IN ('approved', 'rejected') THEN
      RETURN NEW;
    END IF;
    -- Allow admin_notes and resolution_summary updates on final states
    IF NEW.status = OLD.status AND 
       NEW.admin_notes IS DISTINCT FROM OLD.admin_notes OR 
       NEW.resolution_summary IS DISTINCT FROM OLD.resolution_summary THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Dispute is in final status and cannot be edited';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_disputes_no_edit_after_final ON public.commission_disputes;
CREATE TRIGGER trg_disputes_no_edit_after_final
BEFORE UPDATE ON public.commission_disputes
FOR EACH ROW EXECUTE FUNCTION public.prevent_dispute_edit_after_final();

-- C) Status transition validation
CREATE OR REPLACE FUNCTION public.validate_dispute_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ok boolean := false;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  ok :=
    (OLD.status::text = 'submitted' AND NEW.status::text IN ('under_review', 'needs_info', 'rejected')) OR
    (OLD.status::text = 'under_review' AND NEW.status::text IN ('needs_info', 'approved', 'rejected')) OR
    (OLD.status::text = 'needs_info' AND NEW.status::text IN ('under_review', 'submitted', 'rejected')) OR
    (OLD.status::text = 'approved' AND NEW.status::text = 'resolved') OR
    (OLD.status::text = 'rejected' AND NEW.status::text = 'resolved');

  IF NOT ok THEN
    RAISE EXCEPTION 'Invalid dispute status transition: % -> %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_dispute_status_transition ON public.commission_disputes;
CREATE TRIGGER trg_dispute_status_transition
BEFORE UPDATE OF status ON public.commission_disputes
FOR EACH ROW EXECUTE FUNCTION public.validate_dispute_status_transition();

-- =====================================================
-- ADMIN FUNCTIONS
-- =====================================================

-- Admin: Approve dispute & create adjustment ledger entry
CREATE OR REPLACE FUNCTION public.admin_approve_dispute(
  p_dispute_id uuid,
  p_adjustment_amount numeric,
  p_resolution_summary text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.commission_disputes%ROWTYPE;
  new_adj_id uuid;
BEGIN
  IF NOT is_elevated_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO d FROM public.commission_disputes WHERE id = p_dispute_id FOR UPDATE;

  IF d.id IS NULL THEN
    RAISE EXCEPTION 'Dispute not found';
  END IF;

  IF d.status::text NOT IN ('submitted', 'under_review') THEN
    RAISE EXCEPTION 'Dispute not in approvable status (current: %)', d.status;
  END IF;

  -- Create adjustment ledger row
  INSERT INTO public.commission_ledger (
    ambassador_id,
    store_id,
    source_channel,
    source_id,
    source_name,
    gross_amount,
    commission_rate,
    commission_amount,
    status,
    earned_at
  ) VALUES (
    d.ambassador_id,
    d.store_id,
    'adjustment',
    d.id::text,
    COALESCE(d.title, 'Dispute Adjustment #' || LEFT(d.id::text, 8)),
    0,
    0,
    p_adjustment_amount,
    'approved',
    NOW()
  ) RETURNING id INTO new_adj_id;

  UPDATE public.commission_disputes
  SET
    status = 'approved',
    reviewed_at = NOW(),
    resolution_summary = COALESCE(p_resolution_summary, resolution_summary),
    adjustment_ledger_id = new_adj_id,
    assigned_admin_user_id = auth.uid()
  WHERE id = d.id;

  RETURN new_adj_id;
END $$;

-- Admin: Reject dispute
CREATE OR REPLACE FUNCTION public.admin_reject_dispute(
  p_dispute_id uuid,
  p_resolution_summary text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.commission_disputes%ROWTYPE;
BEGIN
  IF NOT is_elevated_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO d FROM public.commission_disputes WHERE id = p_dispute_id FOR UPDATE;

  IF d.status::text NOT IN ('submitted', 'under_review', 'needs_info') THEN
    RAISE EXCEPTION 'Dispute not in rejectable status';
  END IF;

  UPDATE public.commission_disputes
  SET
    status = 'rejected',
    reviewed_at = NOW(),
    resolution_summary = COALESCE(p_resolution_summary, 'Dispute rejected'),
    assigned_admin_user_id = auth.uid()
  WHERE id = p_dispute_id;
END $$;

-- Admin: Resolve dispute (final step)
CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(
  p_dispute_id uuid,
  p_admin_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.commission_disputes%ROWTYPE;
BEGIN
  IF NOT is_elevated_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO d FROM public.commission_disputes WHERE id = p_dispute_id FOR UPDATE;

  IF d.status::text NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Dispute must be approved or rejected before resolving';
  END IF;

  UPDATE public.commission_disputes
  SET
    status = 'resolved',
    resolved_at = NOW(),
    admin_notes = COALESCE(p_admin_notes, admin_notes)
  WHERE id = p_dispute_id;
END $$;

-- Admin: Pick up dispute (assign to self)
CREATE OR REPLACE FUNCTION public.admin_pickup_dispute(p_dispute_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_elevated_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.commission_disputes
  SET
    status = 'under_review',
    assigned_admin_user_id = auth.uid()
  WHERE id = p_dispute_id
    AND status::text = 'submitted';
END $$;

-- Admin: Request more info
CREATE OR REPLACE FUNCTION public.admin_request_info(
  p_dispute_id uuid,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_elevated_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.commission_disputes
  SET status = 'needs_info'
  WHERE id = p_dispute_id
    AND status::text IN ('submitted', 'under_review');

  -- Add admin message
  INSERT INTO public.commission_dispute_messages (
    dispute_id, author_role, author_admin_user_id, message
  ) VALUES (
    p_dispute_id, 'admin', auth.uid(), p_message
  );
END $$;

-- =====================================================
-- VIEWS
-- =====================================================

-- Dispute KPIs per ambassador
CREATE OR REPLACE VIEW public.dispute_kpis AS
SELECT
  ambassador_id,
  COUNT(*) FILTER (WHERE status::text IN ('submitted', 'under_review', 'needs_info')) AS open_disputes,
  COUNT(*) FILTER (WHERE status::text = 'approved') AS approved_disputes,
  COUNT(*) FILTER (WHERE status::text = 'rejected') AS rejected_disputes,
  COUNT(*) FILTER (WHERE status::text = 'resolved') AS resolved_disputes,
  COUNT(*) AS total_disputes
FROM public.commission_disputes
GROUP BY ambassador_id;

-- Admin dispute queue view
CREATE OR REPLACE VIEW public.admin_dispute_queue AS
SELECT
  d.id,
  d.ambassador_id,
  a.name AS ambassador_name,
  d.commission_ledger_id,
  d.reason_code,
  d.title,
  d.description,
  d.requested_amount,
  d.currency,
  d.status,
  d.priority,
  d.submitted_at,
  d.updated_at,
  d.assigned_admin_user_id,
  d.resolution_summary,
  cl.source_name AS ledger_source_name,
  cl.commission_amount AS ledger_amount,
  cl.earned_at AS ledger_earned_at,
  (SELECT COUNT(*) FROM public.commission_dispute_messages m WHERE m.dispute_id = d.id) AS message_count,
  (SELECT COUNT(*) FROM public.commission_dispute_evidence e WHERE e.dispute_id = d.id) AS evidence_count
FROM public.commission_disputes d
JOIN public.ambassadors a ON a.id = d.ambassador_id
LEFT JOIN public.commission_ledger cl ON cl.id = d.commission_ledger_id;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.admin_approve_dispute(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_dispute(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_dispute(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_pickup_dispute(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_request_info(uuid, text) TO authenticated;