
-- TopTier System Controls
CREATE TABLE public.tt_system_controls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  control_key TEXT NOT NULL UNIQUE,
  control_value JSONB DEFAULT '{}'::jsonb,
  enabled BOOLEAN DEFAULT true,
  category TEXT DEFAULT 'general',
  description TEXT,
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tt_system_controls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage system controls"
ON public.tt_system_controls FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default controls
INSERT INTO public.tt_system_controls (control_key, category, description, enabled) VALUES
('pause_bookings', 'operations', 'Pause all new bookings', false),
('emergency_mode', 'emergency', 'Emergency shutdown - disables all services', false),
('disable_charters', 'services', 'Disable charter/jet requests', false),
('disable_experiences', 'services', 'Disable experience bookings', false),
('maintenance_mode', 'system', 'Put platform in maintenance mode', false);

-- TopTier Affiliates
CREATE TABLE public.tt_affiliates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  referral_code TEXT UNIQUE,
  status TEXT DEFAULT 'pending',
  tier TEXT DEFAULT 'bronze',
  total_referrals INTEGER DEFAULT 0,
  total_earned NUMERIC(12,2) DEFAULT 0,
  pending_amount NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tt_affiliates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage affiliates"
ON public.tt_affiliates FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Affiliate commissions for TopTier
CREATE TABLE public.tt_affiliate_commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID REFERENCES public.tt_affiliates(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.tt_bookings(id),
  amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tt_affiliate_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage affiliate commissions"
ON public.tt_affiliate_commissions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
