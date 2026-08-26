-- 1. Link DD affiliates to ambassadors
ALTER TABLE public.dd_affiliates
  ADD COLUMN IF NOT EXISTS ambassador_id uuid REFERENCES public.ambassadors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS dd_affiliates_ambassador_id_idx ON public.dd_affiliates(ambassador_id);

UPDATE public.dd_affiliates a
   SET ambassador_id = amb.id
  FROM public.ambassadors amb
 WHERE amb.user_id = a.user_id
   AND a.user_id IS NOT NULL
   AND a.ambassador_id IS NULL;

-- 2. Idempotency guard for the bridge
CREATE UNIQUE INDEX IF NOT EXISTS commission_ledger_dd_source_uniq
  ON public.commission_ledger (ambassador_id, source_id)
  WHERE source_channel = 'dynasty_direct' AND reversal_of IS NULL;

-- 3. Bridge: dd_affiliate_events -> commission_ledger (HELD)
CREATE OR REPLACE FUNCTION public.dd_bridge_affiliate_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ambassador uuid;
  v_source uuid;
BEGIN
  IF NEW.kind <> 'order' THEN RETURN NEW; END IF;

  SELECT ambassador_id INTO v_ambassador FROM public.dd_affiliates WHERE id = NEW.affiliate_id;
  IF v_ambassador IS NULL THEN RETURN NEW; END IF;

  v_source := COALESCE(NEW.order_id, NEW.id);

  IF NEW.status = 'earned' THEN
    INSERT INTO public.commission_ledger (
      ambassador_id, source_channel, source_id, gross_amount,
      commission_rate, commission_amount, status, earned_at,
      source_name, payout_hold, payout_hold_reason
    )
    VALUES (
      v_ambassador, 'dynasty_direct', v_source, COALESCE(NEW.amount, 0),
      COALESCE(NEW.commission_rate, 0), COALESCE(NEW.commission_amount, 0),
      'pending', COALESCE(NEW.earned_at, now()),
      'Dynasty Direct order', true, 'awaiting_admin_release'
    )
    ON CONFLICT DO NOTHING;

  ELSIF NEW.status = 'reversed' THEN
    UPDATE public.commission_ledger
       SET status = 'reversed',
           payout_hold = true,
           payout_hold_reason = 'order_reversed',
           reversal_reason = 'Dynasty Direct order reversed'
     WHERE source_channel = 'dynasty_direct'
       AND source_id = v_source
       AND ambassador_id = v_ambassador
       AND status <> 'paid';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dd_affiliate_events_commission_bridge ON public.dd_affiliate_events;
CREATE TRIGGER dd_affiliate_events_commission_bridge
AFTER INSERT OR UPDATE OF status ON public.dd_affiliate_events
FOR EACH ROW EXECUTE FUNCTION public.dd_bridge_affiliate_commission();

-- 4. Backfill already-earned DD events for linked ambassadors
INSERT INTO public.commission_ledger (
  ambassador_id, source_channel, source_id, gross_amount,
  commission_rate, commission_amount, status, earned_at,
  source_name, payout_hold, payout_hold_reason
)
SELECT a.ambassador_id, 'dynasty_direct', COALESCE(e.order_id, e.id), COALESCE(e.amount, 0),
       COALESCE(e.commission_rate, 0), COALESCE(e.commission_amount, 0), 'pending',
       COALESCE(e.earned_at, e.created_at, now()), 'Dynasty Direct order', true, 'awaiting_admin_release'
  FROM public.dd_affiliate_events e
  JOIN public.dd_affiliates a ON a.id = e.affiliate_id
 WHERE e.kind = 'order' AND e.status = 'earned' AND a.ambassador_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 5. Ambassador self-serve: get or create my Dynasty Direct referral code
CREATE OR REPLACE FUNCTION public.dd_ensure_ambassador_affiliate()
RETURNS TABLE (affiliate_id uuid, code text, commission_rate numeric, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amb public.ambassadors%ROWTYPE;
  v_code text;
  v_row public.dd_affiliates%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO v_amb FROM public.ambassadors
   WHERE user_id = auth.uid() AND deleted_at IS NULL
   ORDER BY created_at LIMIT 1;
  IF v_amb.id IS NULL THEN RAISE EXCEPTION 'no ambassador account for this user'; END IF;

  SELECT * INTO v_row FROM public.dd_affiliates WHERE ambassador_id = v_amb.id LIMIT 1;
  IF v_row.id IS NOT NULL THEN
    RETURN QUERY SELECT v_row.id, v_row.code, v_row.commission_rate, v_row.status;
    RETURN;
  END IF;

  v_code := upper(regexp_replace(COALESCE(v_amb.referral_code, v_amb.tracking_code, 'AMB' || left(replace(v_amb.id::text,'-',''), 6)), '[^A-Za-z0-9]', '', 'g'));
  WHILE EXISTS (SELECT 1 FROM public.dd_affiliates WHERE code = v_code) LOOP
    v_code := v_code || floor(random()*10)::text;
  END LOOP;

  INSERT INTO public.dd_affiliates (user_id, ambassador_id, code, display_name, email, phone, status, approved_at)
  VALUES (auth.uid(), v_amb.id, v_code, v_amb.name, v_amb.email, v_amb.phone_primary, 'active', now())
  RETURNING * INTO v_row;

  RETURN QUERY SELECT v_row.id, v_row.code, v_row.commission_rate, v_row.status;
END;
$$;

-- 6. Admin release / re-hold (manual approval — no automatic money movement)
CREATE OR REPLACE FUNCTION public.admin_release_dd_commissions(p_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.commission_ledger
     SET status = 'approved', approved_at = now(),
         payout_hold = false, payout_hold_reason = NULL
   WHERE id = ANY(p_ids)
     AND status = 'pending';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_hold_dd_commissions(p_ids uuid[], p_reason text DEFAULT 'admin_hold')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.commission_ledger
     SET payout_hold = true, payout_hold_reason = p_reason
   WHERE id = ANY(p_ids)
     AND status <> 'paid';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dd_ensure_ambassador_affiliate() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_release_dd_commissions(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_hold_dd_commissions(uuid[], text) TO authenticated;