
-- =============================================
-- NEW TABLE: photographer_payout_accounts
-- =============================================
CREATE TABLE IF NOT EXISTS public.photographer_payout_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id UUID NOT NULL REFERENCES public.photographers(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'manual' CHECK (provider IN ('stripe_connect', 'manual')),
  provider_account_id TEXT,
  onboarding_status TEXT DEFAULT 'not_started' CHECK (onboarding_status IN ('not_started', 'in_progress', 'complete', 'restricted')),
  payouts_enabled BOOLEAN DEFAULT false,
  charges_enabled BOOLEAN DEFAULT false,
  tax_status TEXT DEFAULT 'pending' CHECK (tax_status IN ('pending', 'submitted', 'verified', 'failed')),
  identity_status TEXT DEFAULT 'pending' CHECK (identity_status IN ('pending', 'submitted', 'verified', 'failed')),
  default_currency TEXT DEFAULT 'usd',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.photographer_payout_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Photographers view own payout accounts"
  ON public.photographer_payout_accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage payout accounts"
  ON public.photographer_payout_accounts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =============================================
-- NEW TABLE: photographer_payouts
-- =============================================
CREATE TABLE IF NOT EXISTS public.photographer_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id UUID NOT NULL REFERENCES public.photographers(id) ON DELETE CASCADE,
  payout_account_id UUID REFERENCES public.photographer_payout_accounts(id),
  total_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'usd',
  payout_status TEXT NOT NULL DEFAULT 'pending' CHECK (payout_status IN ('pending', 'approved', 'processing', 'paid', 'failed', 'on_hold', 'cancelled')),
  payout_type TEXT NOT NULL DEFAULT 'manual' CHECK (payout_type IN ('automatic', 'manual')),
  requested_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  failure_reason TEXT,
  provider_payout_id TEXT,
  reference_code TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.photographer_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Photographers view own payouts"
  ON public.photographer_payouts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage payouts"
  ON public.photographer_payouts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =============================================
-- NEW TABLE: photographer_payout_items
-- =============================================
CREATE TABLE IF NOT EXISTS public.photographer_payout_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID NOT NULL REFERENCES public.photographer_payouts(id) ON DELETE CASCADE,
  photographer_job_id UUID NOT NULL REFERENCES public.photographer_jobs(id),
  gross_job_amount NUMERIC NOT NULL DEFAULT 0,
  platform_fee NUMERIC NOT NULL DEFAULT 0,
  photographer_payout_amount NUMERIC NOT NULL DEFAULT 0,
  included_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(photographer_job_id)
);

ALTER TABLE public.photographer_payout_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View payout items"
  ON public.photographer_payout_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage payout items"
  ON public.photographer_payout_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =============================================
-- NEW TABLE: photographer_payout_audit_log
-- =============================================
CREATE TABLE IF NOT EXISTS public.photographer_payout_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id UUID NOT NULL REFERENCES public.photographers(id),
  payout_id UUID REFERENCES public.photographer_payouts(id),
  action_type TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  actor_user_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.photographer_payout_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View audit log"
  ON public.photographer_payout_audit_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Insert audit log"
  ON public.photographer_payout_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =============================================
-- EXTEND: photographer_jobs
-- =============================================
ALTER TABLE public.photographer_jobs
  ADD COLUMN IF NOT EXISTS payout_eligible BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS payout_hold_reason TEXT,
  ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payout_id UUID REFERENCES public.photographer_payouts(id),
  ADD COLUMN IF NOT EXISTS payout_eligible_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS admin_verification_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payout_release_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bonus_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjustment_amount NUMERIC DEFAULT 0;

-- =============================================
-- EXTEND: photographers
-- =============================================
ALTER TABLE public.photographers
  ADD COLUMN IF NOT EXISTS payout_method_status TEXT DEFAULT 'not_setup',
  ADD COLUMN IF NOT EXISTS payout_schedule TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS minimum_payout_threshold NUMERIC DEFAULT 50,
  ADD COLUMN IF NOT EXISTS tax_profile_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS compliance_hold BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_payout_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lifetime_paid_out NUMERIC DEFAULT 0;

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_payout_accounts_photographer ON public.photographer_payout_accounts(photographer_id);
CREATE INDEX IF NOT EXISTS idx_payouts_photographer ON public.photographer_payouts(photographer_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.photographer_payouts(payout_status);
CREATE INDEX IF NOT EXISTS idx_payout_items_payout ON public.photographer_payout_items(payout_id);
CREATE INDEX IF NOT EXISTS idx_payout_items_job ON public.photographer_payout_items(photographer_job_id);
CREATE INDEX IF NOT EXISTS idx_payout_audit_photographer ON public.photographer_payout_audit_log(photographer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_payout_eligible ON public.photographer_jobs(payout_eligible) WHERE payout_eligible = true;
CREATE INDEX IF NOT EXISTS idx_jobs_payout_status ON public.photographer_jobs(payout_status);

-- =============================================
-- RPC: Check payout eligibility for a job
-- =============================================
CREATE OR REPLACE FUNCTION public.vt_check_payout_eligibility(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_photographer RECORD;
  v_result JSONB;
  v_eligible BOOLEAN := true;
  v_reasons TEXT[] := '{}';
BEGIN
  SELECT * INTO v_job FROM photographer_jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reasons', ARRAY['Job not found']);
  END IF;

  SELECT * INTO v_photographer FROM photographers WHERE id = v_job.photographer_id;

  -- Check conditions
  IF v_job.status != 'completed' THEN
    v_eligible := false;
    v_reasons := array_append(v_reasons, 'Job not completed');
  END IF;

  IF v_job.qa_status IS NOT NULL AND v_job.qa_status != 'approved' THEN
    v_eligible := false;
    v_reasons := array_append(v_reasons, 'QA not approved');
  END IF;

  IF v_job.dispute_status IS NOT NULL AND v_job.dispute_status NOT IN ('none', 'resolved') THEN
    v_eligible := false;
    v_reasons := array_append(v_reasons, 'Active dispute');
  END IF;

  IF v_photographer.compliance_hold = true THEN
    v_eligible := false;
    v_reasons := array_append(v_reasons, 'Photographer compliance hold');
  END IF;

  IF v_job.payout_hold_reason IS NOT NULL THEN
    v_eligible := false;
    v_reasons := array_append(v_reasons, 'Payout hold: ' || v_job.payout_hold_reason);
  END IF;

  IF v_job.payout_status = 'paid' THEN
    v_eligible := false;
    v_reasons := array_append(v_reasons, 'Already paid');
  END IF;

  -- Update job
  IF v_eligible THEN
    UPDATE photographer_jobs
    SET payout_eligible = true, payout_eligible_at = now()
    WHERE id = p_job_id AND payout_eligible = false;
  END IF;

  RETURN jsonb_build_object('eligible', v_eligible, 'reasons', v_reasons);
END;
$$;
