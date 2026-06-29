
-- 1) dd_store_referrals
CREATE TABLE IF NOT EXISTS public.dd_store_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_store_id uuid REFERENCES public.store_accounts(id) ON DELETE SET NULL,
  referrer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  referred_email text NOT NULL,
  referred_store_id uuid REFERENCES public.store_accounts(id) ON DELETE SET NULL,
  referral_code text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','signed_up','qualified','rewarded')),
  referrer_credit_amount numeric DEFAULT 50,
  referred_discount_pct numeric DEFAULT 10,
  first_order_id uuid,
  rewarded_at timestamptz,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_store_referrals TO authenticated;
GRANT ALL ON public.dd_store_referrals TO service_role;

ALTER TABLE public.dd_store_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Stores view own referrals" ON public.dd_store_referrals;
CREATE POLICY "Stores view own referrals"
  ON public.dd_store_referrals
  FOR ALL TO authenticated
  USING (referrer_user_id = auth.uid())
  WITH CHECK (referrer_user_id = auth.uid());

DROP POLICY IF EXISTS "Admin full access" ON public.dd_store_referrals;
CREATE POLICY "Admin full access"
  ON public.dd_store_referrals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS dd_store_referrals_referrer_idx
  ON public.dd_store_referrals (referrer_user_id, status);
CREATE INDEX IF NOT EXISTS dd_store_referrals_referred_idx
  ON public.dd_store_referrals (referred_store_id);

-- 2) Apply referral at signup — wires the referred store + grants 10% first-order discount.
CREATE OR REPLACE FUNCTION public.dd_apply_store_referral_signup(
  p_referral_code text,
  p_store_account_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref public.dd_store_referrals%ROWTYPE;
BEGIN
  SELECT * INTO ref FROM public.dd_store_referrals
   WHERE referral_code = p_referral_code AND status = 'pending'
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'no_pending_referral');
  END IF;

  UPDATE public.dd_store_referrals
     SET referred_store_id = p_store_account_id,
         status = 'signed_up'
   WHERE id = ref.id;

  -- 10% off all products for 30 days for the referred store
  INSERT INTO public.dd_custom_pricing
    (store_account_id, discount_pct, valid_from, valid_until)
  VALUES
    (p_store_account_id, COALESCE(ref.referred_discount_pct, 10),
     now(), now() + interval '30 days');

  RETURN jsonb_build_object('applied', true, 'referral_id', ref.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.dd_apply_store_referral_signup(text, uuid) TO authenticated, service_role;

-- 3) Qualify + reward referrer on the referred store's first paid order.
CREATE OR REPLACE FUNCTION public.dd_qualify_store_referral(
  p_store_account_id uuid,
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref public.dd_store_referrals%ROWTYPE;
  referrer_loyalty_id uuid;
  pts int;
BEGIN
  SELECT * INTO ref FROM public.dd_store_referrals
   WHERE referred_store_id = p_store_account_id
     AND status = 'signed_up'
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('qualified', false);
  END IF;

  -- 1 dollar credit = 100 points (matches loyalty config).
  pts := COALESCE(ref.referrer_credit_amount, 50)::int * 100;

  -- Find or create the referrer's loyalty account
  SELECT id INTO referrer_loyalty_id
    FROM public.dd_loyalty_accounts
   WHERE user_id = ref.referrer_user_id
   LIMIT 1;

  IF referrer_loyalty_id IS NULL AND ref.referrer_user_id IS NOT NULL THEN
    INSERT INTO public.dd_loyalty_accounts (user_id, store_account_id, points_balance, points_lifetime, tier)
    VALUES (ref.referrer_user_id, ref.referrer_store_id, 0, 0, 'bronze')
    RETURNING id INTO referrer_loyalty_id;
  END IF;

  IF referrer_loyalty_id IS NOT NULL THEN
    INSERT INTO public.dd_loyalty_transactions
      (loyalty_account_id, order_id, transaction_type, points, description)
    VALUES
      (referrer_loyalty_id, p_order_id, 'adjust', pts,
       'Referral reward: $' || COALESCE(ref.referrer_credit_amount, 50)::text || ' store credit');

    UPDATE public.dd_loyalty_accounts
       SET points_balance = COALESCE(points_balance, 0) + pts,
           points_lifetime = COALESCE(points_lifetime, 0) + pts
     WHERE id = referrer_loyalty_id;
  END IF;

  UPDATE public.dd_store_referrals
     SET status = 'rewarded',
         first_order_id = p_order_id,
         rewarded_at = now()
   WHERE id = ref.id;

  -- Mark intermediate qualified too (auditable)
  RETURN jsonb_build_object(
    'qualified', true,
    'referral_id', ref.id,
    'referrer_user_id', ref.referrer_user_id,
    'points_awarded', pts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dd_qualify_store_referral(uuid, uuid) TO authenticated, service_role;
