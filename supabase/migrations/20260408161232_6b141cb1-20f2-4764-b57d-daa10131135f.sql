
-- Dynasty Earn Affiliate System Tables

CREATE TABLE public.dynasty_earn_affiliates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'ambassador' CHECK (role IN ('ambassador', 'model', 'nonprofit')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending', 'suspended')),
  referral_code TEXT UNIQUE,
  business_units TEXT[] DEFAULT '{}',
  lifetime_earnings NUMERIC DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_conversions INTEGER DEFAULT 0,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.dynasty_earn_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT NOT NULL,
  program_name TEXT NOT NULL,
  description TEXT,
  commission_type TEXT NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed')),
  commission_value NUMERIC NOT NULL DEFAULT 0,
  recurring BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  max_affiliates INTEGER,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.dynasty_earn_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.dynasty_earn_affiliates(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.dynasty_earn_programs(id) ON DELETE CASCADE,
  unique_code TEXT NOT NULL UNIQUE,
  destination_url TEXT,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.dynasty_earn_commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.dynasty_earn_affiliates(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.dynasty_earn_programs(id) ON DELETE CASCADE,
  link_id UUID REFERENCES public.dynasty_earn_links(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'disputed')),
  source_description TEXT,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.dynasty_earn_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.dynasty_earn_affiliates(id) ON DELETE CASCADE,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  payout_method TEXT DEFAULT 'bank_transfer',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  processed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.dynasty_earn_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.dynasty_earn_affiliates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_dynasty_earn_affiliates_status ON public.dynasty_earn_affiliates(status);
CREATE INDEX idx_dynasty_earn_affiliates_role ON public.dynasty_earn_affiliates(role);
CREATE INDEX idx_dynasty_earn_links_affiliate ON public.dynasty_earn_links(affiliate_id);
CREATE INDEX idx_dynasty_earn_links_code ON public.dynasty_earn_links(unique_code);
CREATE INDEX idx_dynasty_earn_commissions_affiliate ON public.dynasty_earn_commissions(affiliate_id);
CREATE INDEX idx_dynasty_earn_commissions_status ON public.dynasty_earn_commissions(status);
CREATE INDEX idx_dynasty_earn_payouts_affiliate ON public.dynasty_earn_payouts(affiliate_id);
CREATE INDEX idx_dynasty_earn_notifications_affiliate ON public.dynasty_earn_notifications(affiliate_id);

-- RLS
ALTER TABLE public.dynasty_earn_affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynasty_earn_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynasty_earn_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynasty_earn_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynasty_earn_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynasty_earn_notifications ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can read all, manage their own
CREATE POLICY "Authenticated read all affiliates" ON public.dynasty_earn_affiliates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage own affiliate" ON public.dynasty_earn_affiliates FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Service role full access affiliates" ON public.dynasty_earn_affiliates FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read programs" ON public.dynasty_earn_programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert programs" ON public.dynasty_earn_programs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Service role full access programs" ON public.dynasty_earn_programs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read own links" ON public.dynasty_earn_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage own links" ON public.dynasty_earn_links FOR ALL TO authenticated USING (affiliate_id IN (SELECT id FROM public.dynasty_earn_affiliates WHERE user_id = auth.uid())) WITH CHECK (affiliate_id IN (SELECT id FROM public.dynasty_earn_affiliates WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access links" ON public.dynasty_earn_links FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read own commissions" ON public.dynasty_earn_commissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage own commissions" ON public.dynasty_earn_commissions FOR ALL TO authenticated USING (affiliate_id IN (SELECT id FROM public.dynasty_earn_affiliates WHERE user_id = auth.uid())) WITH CHECK (affiliate_id IN (SELECT id FROM public.dynasty_earn_affiliates WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access commissions" ON public.dynasty_earn_commissions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read own payouts" ON public.dynasty_earn_payouts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage own payouts" ON public.dynasty_earn_payouts FOR ALL TO authenticated USING (affiliate_id IN (SELECT id FROM public.dynasty_earn_affiliates WHERE user_id = auth.uid())) WITH CHECK (affiliate_id IN (SELECT id FROM public.dynasty_earn_affiliates WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access payouts" ON public.dynasty_earn_payouts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read own notifications" ON public.dynasty_earn_notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage own notifications" ON public.dynasty_earn_notifications FOR ALL TO authenticated USING (affiliate_id IN (SELECT id FROM public.dynasty_earn_affiliates WHERE user_id = auth.uid())) WITH CHECK (affiliate_id IN (SELECT id FROM public.dynasty_earn_affiliates WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access notifications" ON public.dynasty_earn_notifications FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.update_dynasty_earn_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_dynasty_earn_affiliates_updated
  BEFORE UPDATE ON public.dynasty_earn_affiliates
  FOR EACH ROW EXECUTE FUNCTION public.update_dynasty_earn_updated_at();

CREATE TRIGGER trg_dynasty_earn_programs_updated
  BEFORE UPDATE ON public.dynasty_earn_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_dynasty_earn_updated_at();
