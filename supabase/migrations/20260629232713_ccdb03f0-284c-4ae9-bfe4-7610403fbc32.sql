
CREATE TABLE IF NOT EXISTS public.dd_partner_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  business_name text,
  partner_type text DEFAULT 'both' CHECK (partner_type IN ('wholesaler_referral','campaign','both')),
  stripe_connect_account_id text,
  stripe_connect_onboarded boolean DEFAULT false,
  payout_method text,
  payout_last4 text,
  payout_bank_name text,
  total_earned_lifetime numeric DEFAULT 0,
  total_paid_lifetime numeric DEFAULT 0,
  pending_balance numeric DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('pending','active','suspended')),
  notes text,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_partner_profiles TO authenticated;
GRANT ALL ON public.dd_partner_profiles TO service_role;
ALTER TABLE public.dd_partner_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dd_pp_view_own" ON public.dd_partner_profiles;
CREATE POLICY "dd_pp_view_own" ON public.dd_partner_profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "dd_pp_update_own" ON public.dd_partner_profiles;
CREATE POLICY "dd_pp_update_own" ON public.dd_partner_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "dd_pp_admin_all" ON public.dd_partner_profiles;
CREATE POLICY "dd_pp_admin_all" ON public.dd_partner_profiles FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.dd_partner_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.dd_partner_profiles(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_revenue numeric DEFAULT 0,
  total_costs numeric DEFAULT 0,
  net_profit numeric DEFAULT 0,
  partner_share_pct numeric DEFAULT 50,
  partner_earnings numeric DEFAULT 0,
  wholesaler_referral_earnings numeric DEFAULT 0,
  campaign_earnings numeric DEFAULT 0,
  status text DEFAULT 'calculating' CHECK (status IN ('calculating','pending_review','approved','processing','paid','disputed')),
  stripe_transfer_id text,
  approved_by uuid,
  approved_at timestamptz,
  paid_at timestamptz,
  partner_viewed_at timestamptz,
  partner_approved_at timestamptz,
  dispute_reason text,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, period_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_partner_payouts TO authenticated;
GRANT ALL ON public.dd_partner_payouts TO service_role;
ALTER TABLE public.dd_partner_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dd_ppay_view_own" ON public.dd_partner_payouts;
CREATE POLICY "dd_ppay_view_own" ON public.dd_partner_payouts FOR SELECT TO authenticated
  USING (partner_id IN (SELECT id FROM public.dd_partner_profiles WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "dd_ppay_admin_all" ON public.dd_partner_payouts;
CREATE POLICY "dd_ppay_admin_all" ON public.dd_partner_payouts FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- Extend dd_partner_earnings with profit fields and calculation_type
ALTER TABLE public.dd_partner_earnings
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES public.dd_partner_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_cost numeric,
  ADD COLUMN IF NOT EXISTS order_profit numeric,
  ADD COLUMN IF NOT EXISTS calculation_type text DEFAULT 'revenue_share';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE constraint_name='dd_partner_earnings_calc_type_check') THEN
    ALTER TABLE public.dd_partner_earnings ADD CONSTRAINT dd_partner_earnings_calc_type_check CHECK (calculation_type IN ('profit_split','revenue_share'));
  END IF;
END $$;

-- Profit calc: marketplace_orders.total minus sum(qty*wholesale_price)
CREATE OR REPLACE FUNCTION public.dd_calculate_order_profit(p_order_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_revenue numeric;
  v_cost numeric;
BEGIN
  SELECT total INTO v_revenue FROM public.marketplace_orders WHERE id = p_order_id;
  SELECT COALESCE(SUM(moi.qty * COALESCE(pa.wholesale_price, 0)), 0) INTO v_cost
  FROM public.marketplace_order_items moi
  JOIN public.products_all pa ON pa.id = moi.product_id
  WHERE moi.order_id = p_order_id;
  RETURN GREATEST(COALESCE(v_revenue,0) - COALESCE(v_cost,0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.dd_calculate_partner_monthly_earnings(
  p_partner_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral numeric := 0;
  v_revenue numeric := 0;
  v_costs numeric := 0;
  v_profit numeric := 0;
  v_campaign numeric := 0;
BEGIN
  SELECT COALESCE(SUM(commission_amount),0) INTO v_referral
  FROM public.dd_partner_earnings
  WHERE partner_id = p_partner_id
    AND calculation_type = 'revenue_share'
    AND created_at::date BETWEEN p_period_start AND p_period_end
    AND status != 'cancelled';

  SELECT
    COALESCE(SUM(order_revenue),0),
    COALESCE(SUM(order_cost),0),
    COALESCE(SUM(order_profit),0),
    COALESCE(SUM(commission_amount),0)
  INTO v_revenue, v_costs, v_profit, v_campaign
  FROM public.dd_partner_earnings
  WHERE partner_id = p_partner_id
    AND calculation_type = 'profit_split'
    AND created_at::date BETWEEN p_period_start AND p_period_end
    AND status != 'cancelled';

  RETURN jsonb_build_object(
    'referral_earnings', v_referral,
    'campaign_revenue', v_revenue,
    'campaign_costs', v_costs,
    'campaign_profit', v_profit,
    'campaign_earnings', v_campaign,
    'total_earnings', v_referral + v_campaign
  );
END;
$$;
