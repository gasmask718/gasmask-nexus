-- =============================================
-- PAYOUTS PHASE: Tables, Views, Functions, RLS
-- =============================================

-- 1. Payout Batches Table
CREATE TABLE IF NOT EXISTS public.payout_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL CHECK (status IN ('draft', 'ready', 'processing', 'paid', 'failed', 'void')) DEFAULT 'draft',
  subtotal_amount numeric(12,2) NOT NULL DEFAULT 0,
  adjustments_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  statement_url text,
  export_ref text,
  paid_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ambassador_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_payout_batches_ambassador_period ON public.payout_batches(ambassador_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_payout_batches_status ON public.payout_batches(status);

-- 2. Payout Items Table
CREATE TABLE IF NOT EXISTS public.payout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_batch_id uuid NOT NULL REFERENCES public.payout_batches(id) ON DELETE CASCADE,
  commission_ledger_id uuid NOT NULL REFERENCES public.commission_ledger(id) ON DELETE RESTRICT,
  commission_amount numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payout_batch_id, commission_ledger_id),
  UNIQUE (commission_ledger_id)
);

CREATE INDEX IF NOT EXISTS idx_payout_items_batch ON public.payout_items(payout_batch_id);
CREATE INDEX IF NOT EXISTS idx_payout_items_ledger ON public.payout_items(commission_ledger_id);

-- 3. Ambassador Payout Methods Table
CREATE TABLE IF NOT EXISTS public.ambassador_payout_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  method_type text NOT NULL CHECK (method_type IN ('ach', 'stripe_connect', 'paypal', 'cashapp', 'zelle', 'manual')),
  method_label text,
  is_default boolean NOT NULL DEFAULT false,
  external_ref text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_default_payout_method ON public.ambassador_payout_methods(ambassador_id) WHERE is_default = true AND active = true;

-- 4. Add payout fields to commission_ledger
ALTER TABLE public.commission_ledger
  ADD COLUMN IF NOT EXISTS payout_batch_id uuid REFERENCES public.payout_batches(id),
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_commission_ledger_payout_batch ON public.commission_ledger(payout_batch_id);

-- 5. Ambassador Payout History View
CREATE OR REPLACE VIEW public.ambassador_payout_history AS
SELECT
  pb.id, pb.ambassador_id, pb.period_start, pb.period_end, pb.status, pb.currency,
  pb.subtotal_amount, pb.adjustments_amount, pb.total_amount, pb.statement_url,
  pb.export_ref, pb.paid_at, pb.created_at,
  (SELECT count(*) FROM public.payout_items pi WHERE pi.payout_batch_id = pb.id) AS items_count
FROM public.payout_batches pb;

-- 6. Unpaid Approved Commission Totals View
CREATE OR REPLACE VIEW public.ambassador_unpaid_commission_totals AS
SELECT ambassador_id, SUM(commission_amount) AS unpaid_approved_total, COUNT(*) AS unpaid_approved_count
FROM public.commission_ledger
WHERE status = 'approved' AND payout_batch_id IS NULL
GROUP BY ambassador_id;

-- 7. Create Payout Batch Function
CREATE OR REPLACE FUNCTION public.create_payout_batch_for_ambassador(p_ambassador_id uuid, p_period_start date, p_period_end date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_batch_id uuid; v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  INSERT INTO payout_batches (ambassador_id, period_start, period_end, status, created_by)
  VALUES (p_ambassador_id, p_period_start, p_period_end, 'draft', v_user_id)
  ON CONFLICT (ambassador_id, period_start, period_end) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_batch_id;

  INSERT INTO payout_items (payout_batch_id, commission_ledger_id, commission_amount)
  SELECT v_batch_id, cl.id, cl.commission_amount FROM commission_ledger cl
  WHERE cl.ambassador_id = p_ambassador_id AND cl.status = 'approved' AND cl.payout_batch_id IS NULL
    AND cl.earned_at::date BETWEEN p_period_start AND p_period_end
  ON CONFLICT DO NOTHING;

  UPDATE commission_ledger cl SET payout_batch_id = v_batch_id
  WHERE cl.ambassador_id = p_ambassador_id AND cl.status = 'approved' AND cl.payout_batch_id IS NULL
    AND cl.earned_at::date BETWEEN p_period_start AND p_period_end
    AND EXISTS (SELECT 1 FROM payout_items pi WHERE pi.payout_batch_id = v_batch_id AND pi.commission_ledger_id = cl.id);

  UPDATE payout_batches pb SET
    subtotal_amount = COALESCE((SELECT SUM(pi.commission_amount) FROM payout_items pi WHERE pi.payout_batch_id = pb.id), 0),
    adjustments_amount = 0,
    total_amount = COALESCE((SELECT SUM(pi.commission_amount) FROM payout_items pi WHERE pi.payout_batch_id = pb.id), 0),
    updated_at = now()
  WHERE pb.id = v_batch_id;

  INSERT INTO entity_audit_log (entity_type, entity_id, action, actor_id, new_values)
  VALUES ('payout_batch', v_batch_id, 'created', v_user_id, jsonb_build_object('ambassador_id', p_ambassador_id, 'period_start', p_period_start, 'period_end', p_period_end));
  RETURN v_batch_id;
END; $$;

-- 8. Finalize Payout Batch Function
CREATE OR REPLACE FUNCTION public.finalize_payout_batch(p_batch_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid; v_old_status text;
BEGIN
  v_user_id := auth.uid();
  SELECT status INTO v_old_status FROM payout_batches WHERE id = p_batch_id;
  UPDATE payout_batches SET status = 'ready', updated_at = now() WHERE id = p_batch_id AND status = 'draft';
  IF FOUND THEN
    INSERT INTO entity_audit_log (entity_type, entity_id, action, actor_id, old_values, new_values)
    VALUES ('payout_batch', p_batch_id, 'finalized', v_user_id, jsonb_build_object('status', v_old_status), jsonb_build_object('status', 'ready'));
  END IF;
END; $$;

-- 9. Mark Payout Batch Paid Function
CREATE OR REPLACE FUNCTION public.mark_payout_batch_paid(p_batch_id uuid, p_export_ref text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_now timestamptz := now(); v_user_id uuid; v_old_status text; v_items_updated integer;
BEGIN
  v_user_id := auth.uid();
  SELECT status INTO v_old_status FROM payout_batches WHERE id = p_batch_id;
  UPDATE payout_batches SET status = 'paid', export_ref = COALESCE(p_export_ref, export_ref), paid_at = v_now, updated_at = v_now
  WHERE id = p_batch_id AND status IN ('ready', 'processing');
  IF FOUND THEN
    UPDATE commission_ledger cl SET status = 'paid', paid_at = v_now WHERE cl.payout_batch_id = p_batch_id AND cl.status = 'approved';
    GET DIAGNOSTICS v_items_updated = ROW_COUNT;
    INSERT INTO entity_audit_log (entity_type, entity_id, action, actor_id, old_values, new_values)
    VALUES ('payout_batch', p_batch_id, 'paid', v_user_id, jsonb_build_object('status', v_old_status), jsonb_build_object('status', 'paid', 'export_ref', p_export_ref, 'items_marked_paid', v_items_updated));
  END IF;
END; $$;

-- 10. Void Payout Batch Function
CREATE OR REPLACE FUNCTION public.void_payout_batch(p_batch_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid; v_old_status text;
BEGIN
  v_user_id := auth.uid();
  SELECT status INTO v_old_status FROM payout_batches WHERE id = p_batch_id;
  IF v_old_status NOT IN ('draft', 'ready') THEN RAISE EXCEPTION 'Cannot void batch with status %', v_old_status; END IF;
  UPDATE commission_ledger SET payout_batch_id = NULL WHERE payout_batch_id = p_batch_id;
  DELETE FROM payout_items WHERE payout_batch_id = p_batch_id;
  UPDATE payout_batches SET status = 'void', updated_at = now() WHERE id = p_batch_id;
  INSERT INTO entity_audit_log (entity_type, entity_id, action, actor_id, old_values, new_values)
  VALUES ('payout_batch', p_batch_id, 'voided', v_user_id, jsonb_build_object('status', v_old_status), jsonb_build_object('status', 'void'));
END; $$;

-- 11. RLS for Payout Batches
ALTER TABLE public.payout_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payout_batches_read ON public.payout_batches;
CREATE POLICY payout_batches_read ON public.payout_batches FOR SELECT USING (ambassador_id = public.current_ambassador_id() OR public.is_elevated_user());
DROP POLICY IF EXISTS payout_batches_admin_insert ON public.payout_batches;
CREATE POLICY payout_batches_admin_insert ON public.payout_batches FOR INSERT WITH CHECK (public.is_elevated_user());
DROP POLICY IF EXISTS payout_batches_admin_update ON public.payout_batches;
CREATE POLICY payout_batches_admin_update ON public.payout_batches FOR UPDATE USING (public.is_elevated_user());

-- 12. RLS for Payout Items
ALTER TABLE public.payout_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payout_items_read ON public.payout_items;
CREATE POLICY payout_items_read ON public.payout_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.payout_batches pb WHERE pb.id = payout_items.payout_batch_id AND (pb.ambassador_id = public.current_ambassador_id() OR public.is_elevated_user())));
DROP POLICY IF EXISTS payout_items_admin_insert ON public.payout_items;
CREATE POLICY payout_items_admin_insert ON public.payout_items FOR INSERT WITH CHECK (public.is_elevated_user());
DROP POLICY IF EXISTS payout_items_admin_delete ON public.payout_items;
CREATE POLICY payout_items_admin_delete ON public.payout_items FOR DELETE USING (public.is_elevated_user());

-- 13. RLS for Ambassador Payout Methods
ALTER TABLE public.ambassador_payout_methods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payout_methods_owner ON public.ambassador_payout_methods;
CREATE POLICY payout_methods_owner ON public.ambassador_payout_methods FOR ALL USING (ambassador_id = public.current_ambassador_id() OR public.is_elevated_user()) WITH CHECK (ambassador_id = public.current_ambassador_id() OR public.is_elevated_user());

-- 14. Grants
GRANT SELECT ON public.ambassador_payout_history TO authenticated;
GRANT SELECT ON public.ambassador_unpaid_commission_totals TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_payout_batch_for_ambassador TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_payout_batch TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_payout_batch_paid TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_payout_batch TO authenticated;