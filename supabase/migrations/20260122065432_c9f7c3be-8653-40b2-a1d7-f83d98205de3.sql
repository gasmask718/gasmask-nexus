-- =============================================
-- AUTO PAYOUT ENGINE - COMPLETE (Tables + Views + Functions)
-- =============================================

-- A) Ambassador payout accounts (destination + compliance)
CREATE TABLE IF NOT EXISTS public.ambassador_payout_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('stripe','manual')),
  provider_account_id text,
  provider_payout_method_id text,
  payouts_enabled boolean NOT NULL DEFAULT false,
  kyc_status text NOT NULL DEFAULT 'unverified'
    CHECK (kyc_status IN ('unverified','pending','verified','rejected')),
  country text DEFAULT 'US',
  currency text NOT NULL DEFAULT 'USD',
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ambassador_id, provider)
);

-- B) Payout batches
CREATE TABLE IF NOT EXISTS public.payout_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','review','approved','processing','paid','failed','cancelled')),
  total_amount numeric NOT NULL DEFAULT 0,
  items_count int NOT NULL DEFAULT 0,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  payout_provider text NOT NULL DEFAULT 'stripe'
    CHECK (payout_provider IN ('stripe','manual')),
  export_csv_url text,
  statement_zip_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- C) Payout batch items
CREATE TABLE IF NOT EXISTS public.payout_batch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_batch_id uuid NOT NULL REFERENCES public.payout_batches(id) ON DELETE CASCADE,
  ambassador_id uuid NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  payout_account_id uuid REFERENCES public.ambassador_payout_accounts(id),
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','processing','paid','failed','skipped')),
  provider_transfer_id text,
  provider_payout_id text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payout_batch_id, ambassador_id)
);

-- D) Payout item ↔ ledger mapping
CREATE TABLE IF NOT EXISTS public.payout_item_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_batch_item_id uuid NOT NULL REFERENCES public.payout_batch_items(id) ON DELETE CASCADE,
  commission_ledger_id uuid NOT NULL REFERENCES public.commission_ledger(id) ON DELETE RESTRICT,
  UNIQUE (payout_batch_item_id, commission_ledger_id),
  UNIQUE (commission_ledger_id)
);

-- E) Payout attempts
CREATE TABLE IF NOT EXISTS public.payout_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_batch_item_id uuid NOT NULL REFERENCES public.payout_batch_items(id) ON DELETE CASCADE,
  attempt_no int NOT NULL DEFAULT 1,
  idempotency_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('started','succeeded','failed')),
  provider_response jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payout_batch_item_id, idempotency_key)
);

-- F) Add columns to commission_ledger
ALTER TABLE public.commission_ledger
  ADD COLUMN IF NOT EXISTS payout_hold boolean NOT NULL DEFAULT false;
ALTER TABLE public.commission_ledger
  ADD COLUMN IF NOT EXISTS payout_hold_reason text;
ALTER TABLE public.commission_ledger
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE public.commission_ledger
  ADD COLUMN IF NOT EXISTS paid_batch_item_id uuid REFERENCES public.payout_batch_items(id);

-- =============================================
-- VIEWS
-- =============================================

-- View: Eligible commissions for payout
CREATE OR REPLACE VIEW public.v_commissions_payable AS
SELECT cl.*
FROM public.commission_ledger cl
LEFT JOIN public.payout_item_ledger pil ON pil.commission_ledger_id = cl.id
WHERE cl.status = 'approved'
  AND cl.payout_hold = false
  AND pil.commission_ledger_id IS NULL;

-- View: Payout batch export
CREATE OR REPLACE VIEW public.v_payout_batch_export AS
SELECT
  pb.id AS batch_id, pb.period_start, pb.period_end,
  pbi.ambassador_id, a.name AS ambassador_name,
  pbi.amount, pbi.currency, pbi.status,
  pbi.provider_transfer_id, pbi.provider_payout_id
FROM public.payout_batches pb
JOIN public.payout_batch_items pbi ON pbi.payout_batch_id = pb.id
JOIN public.ambassadors a ON a.id = pbi.ambassador_id;

-- View: Statement line items
CREATE OR REPLACE VIEW public.v_payout_item_statement_lines AS
SELECT
  pbi.id AS payout_batch_item_id, pb.id AS batch_id,
  pb.period_start, pb.period_end,
  cl.id AS commission_id, cl.source_channel, cl.source_name,
  cl.commission_amount, cl.earned_at, cl.override_plan_id, cl.parent_commission_id
FROM public.payout_batch_items pbi
JOIN public.payout_batches pb ON pb.id = pbi.payout_batch_id
JOIN public.payout_item_ledger pil ON pil.payout_batch_item_id = pbi.id
JOIN public.commission_ledger cl ON cl.id = pil.commission_ledger_id;

-- =============================================
-- FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION public.create_payout_batch(
  p_period_start date, p_period_end date,
  p_provider text DEFAULT 'stripe', p_created_by uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_batch_id uuid;
BEGIN
  INSERT INTO payout_batches (period_start, period_end, status, payout_provider, created_by)
  VALUES (p_period_start, p_period_end, 'draft', p_provider, p_created_by)
  RETURNING id INTO v_batch_id;

  INSERT INTO payout_batch_items (payout_batch_id, ambassador_id, payout_account_id, amount, currency, status)
  SELECT v_batch_id, cl.ambassador_id, apa.id, round(sum(cl.commission_amount), 2), 'USD', 'queued'
  FROM v_commissions_payable cl
  LEFT JOIN ambassador_payout_accounts apa ON apa.ambassador_id = cl.ambassador_id AND apa.provider = p_provider
  WHERE cl.earned_at::date BETWEEN p_period_start AND p_period_end
  GROUP BY cl.ambassador_id, apa.id HAVING sum(cl.commission_amount) > 0;

  INSERT INTO payout_item_ledger (payout_batch_item_id, commission_ledger_id)
  SELECT pbi.id, cl.id FROM payout_batch_items pbi
  JOIN v_commissions_payable cl ON cl.ambassador_id = pbi.ambassador_id
  WHERE pbi.payout_batch_id = v_batch_id AND cl.earned_at::date BETWEEN p_period_start AND p_period_end;

  UPDATE payout_batches SET
    total_amount = COALESCE((SELECT sum(amount) FROM payout_batch_items WHERE payout_batch_id = v_batch_id), 0),
    items_count = COALESCE((SELECT count(*) FROM payout_batch_items WHERE payout_batch_id = v_batch_id), 0)
  WHERE id = v_batch_id;
  RETURN v_batch_id;
END; $$;

CREATE OR REPLACE FUNCTION public.submit_payout_batch_for_review(p_batch_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE payout_batches SET status = 'review' WHERE id = p_batch_id AND status = 'draft'; END; $$;

CREATE OR REPLACE FUNCTION public.approve_payout_batch(p_batch_id uuid, p_approved_by uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE payout_batches SET status = 'approved', approved_at = now(), approved_by = p_approved_by
WHERE id = p_batch_id AND status IN ('draft', 'review'); END; $$;

CREATE OR REPLACE FUNCTION public.start_payout_batch_processing(p_batch_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE payout_batches SET status = 'processing' WHERE id = p_batch_id AND status = 'approved'; END; $$;

CREATE OR REPLACE FUNCTION public.mark_payout_item_paid(p_item_id uuid, p_transfer_id text DEFAULT NULL, p_payout_id text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE payout_batch_items SET status = 'paid',
    provider_transfer_id = COALESCE(p_transfer_id, provider_transfer_id),
    provider_payout_id = COALESCE(p_payout_id, provider_payout_id)
  WHERE id = p_item_id AND status IN ('queued', 'processing');
  UPDATE commission_ledger SET status = 'paid', paid_at = now(), paid_batch_item_id = p_item_id
  WHERE id IN (SELECT commission_ledger_id FROM payout_item_ledger WHERE payout_batch_item_id = p_item_id);
END; $$;

CREATE OR REPLACE FUNCTION public.mark_payout_item_failed(p_item_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE payout_batch_items SET status = 'failed', failure_reason = p_reason
WHERE id = p_item_id AND status IN ('queued', 'processing'); END; $$;

CREATE OR REPLACE FUNCTION public.skip_payout_item(p_item_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE payout_batch_items SET status = 'skipped', failure_reason = p_reason WHERE id = p_item_id AND status = 'queued';
  DELETE FROM payout_item_ledger WHERE payout_batch_item_id = p_item_id;
END; $$;

CREATE OR REPLACE FUNCTION public.finalize_payout_batch(p_batch_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total int; v_paid int; v_failed int;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE status = 'paid'), count(*) FILTER (WHERE status = 'failed')
  INTO v_total, v_paid, v_failed FROM payout_batch_items WHERE payout_batch_id = p_batch_id;
  IF v_failed > 0 AND v_paid = 0 THEN UPDATE payout_batches SET status = 'failed' WHERE id = p_batch_id;
  ELSIF v_paid + v_failed >= v_total THEN UPDATE payout_batches SET status = 'paid' WHERE id = p_batch_id; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_payout_batch(p_batch_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM payout_batches WHERE id = p_batch_id AND status IN ('draft', 'review')) THEN
    DELETE FROM payout_item_ledger WHERE payout_batch_item_id IN (SELECT id FROM payout_batch_items WHERE payout_batch_id = p_batch_id);
    DELETE FROM payout_batch_items WHERE payout_batch_id = p_batch_id;
    UPDATE payout_batches SET status = 'cancelled' WHERE id = p_batch_id;
  END IF;
END; $$;

-- =============================================
-- RLS
-- =============================================
ALTER TABLE public.ambassador_payout_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_item_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "amb_view_own_payout_accounts" ON public.ambassador_payout_accounts FOR SELECT
USING (ambassador_id IN (SELECT id FROM ambassadors WHERE user_id = auth.uid()) OR is_elevated_user());

CREATE POLICY "amb_insert_own_payout_accounts" ON public.ambassador_payout_accounts FOR INSERT
WITH CHECK (ambassador_id IN (SELECT id FROM ambassadors WHERE user_id = auth.uid()) OR is_elevated_user());

CREATE POLICY "amb_update_own_payout_accounts" ON public.ambassador_payout_accounts FOR UPDATE
USING (ambassador_id IN (SELECT id FROM ambassadors WHERE user_id = auth.uid()) OR is_elevated_user());

CREATE POLICY "admin_manage_payout_batches" ON public.payout_batches FOR ALL USING (is_elevated_user());

CREATE POLICY "amb_view_own_batches" ON public.payout_batches FOR SELECT
USING (id IN (SELECT payout_batch_id FROM payout_batch_items WHERE ambassador_id IN (SELECT id FROM ambassadors WHERE user_id = auth.uid())));

CREATE POLICY "admin_manage_payout_items" ON public.payout_batch_items FOR ALL USING (is_elevated_user());

CREATE POLICY "amb_view_own_payout_items" ON public.payout_batch_items FOR SELECT
USING (ambassador_id IN (SELECT id FROM ambassadors WHERE user_id = auth.uid()));

CREATE POLICY "admin_only_payout_item_ledger" ON public.payout_item_ledger FOR ALL USING (is_elevated_user());

CREATE POLICY "admin_only_payout_attempts" ON public.payout_attempts FOR ALL USING (is_elevated_user());

-- =============================================
-- TRIGGERS
-- =============================================
CREATE OR REPLACE FUNCTION public.trg_hold_commission_on_dispute()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'open' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'open') THEN
    UPDATE commission_ledger SET payout_hold = true, payout_hold_reason = 'Dispute: ' || NEW.id WHERE id = NEW.ledger_entry_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_dispute_hold_commission ON public.commission_disputes;
CREATE TRIGGER trg_dispute_hold_commission AFTER INSERT OR UPDATE ON public.commission_disputes
FOR EACH ROW EXECUTE FUNCTION trg_hold_commission_on_dispute();

CREATE OR REPLACE FUNCTION public.trg_release_hold_on_dispute_resolution()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('approved', 'rejected') AND (OLD IS NULL OR OLD.status NOT IN ('approved', 'rejected')) THEN
    UPDATE commission_ledger SET payout_hold = false, payout_hold_reason = NULL WHERE id = NEW.ledger_entry_id AND payout_hold = true;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_dispute_release_hold ON public.commission_disputes;
CREATE TRIGGER trg_dispute_release_hold AFTER UPDATE ON public.commission_disputes
FOR EACH ROW EXECUTE FUNCTION trg_release_hold_on_dispute_resolution();