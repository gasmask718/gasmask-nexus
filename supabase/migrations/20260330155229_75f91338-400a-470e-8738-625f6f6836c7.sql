
-- Extend unforgettable_ambassadors with revenue tracking columns
ALTER TABLE public.unforgettable_ambassadors
  ADD COLUMN IF NOT EXISTS total_referrals integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_converted_referrals integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_revenue numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_commissions numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_status text DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS last_conversion_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_payout_at timestamptz,
  ADD COLUMN IF NOT EXISTS active_referral_link text;

-- Create ambassador_referrals table for click/lead/conversion attribution
CREATE TABLE IF NOT EXISTS public.ut_ambassador_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid REFERENCES public.unforgettable_ambassadors(id) ON DELETE CASCADE NOT NULL,
  referral_code text NOT NULL,
  business_slug text DEFAULT 'unforgettable-times',
  visitor_session_id text,
  lead_name text,
  lead_email text,
  lead_phone text,
  referral_source text,
  landing_page text,
  status text DEFAULT 'clicked' NOT NULL,
  converted_at timestamptz,
  revenue_amount numeric DEFAULT 0,
  commission_amount numeric DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ut_amb_ref_code ON public.ut_ambassador_referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_ut_amb_ref_ambassador ON public.ut_ambassador_referrals(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_ut_amb_ref_status ON public.ut_ambassador_referrals(status);

-- Create ambassador_payouts table for payout tracking
CREATE TABLE IF NOT EXISTS public.ut_ambassador_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid REFERENCES public.unforgettable_ambassadors(id) ON DELETE CASCADE NOT NULL,
  business_slug text DEFAULT 'unforgettable-times',
  payout_period_start date,
  payout_period_end date,
  gross_revenue numeric DEFAULT 0,
  commission_amount numeric DEFAULT 0,
  payout_status text DEFAULT 'pending' NOT NULL,
  payout_method text,
  payout_reference text,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ut_amb_payout_ambassador ON public.ut_ambassador_payouts(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_ut_amb_payout_status ON public.ut_ambassador_payouts(payout_status);

-- Enable RLS
ALTER TABLE public.ut_ambassador_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_ambassador_payouts ENABLE ROW LEVEL SECURITY;

-- RLS: Allow authenticated users full access (admin context)
CREATE POLICY "Authenticated users can manage referrals" ON public.ut_ambassador_referrals
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage payouts" ON public.ut_ambassador_payouts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow anon to insert referrals (public tracking)
CREATE POLICY "Anon can insert referrals" ON public.ut_ambassador_referrals
  FOR INSERT TO anon WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ut_ambassador_referrals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ut_ambassador_payouts;
