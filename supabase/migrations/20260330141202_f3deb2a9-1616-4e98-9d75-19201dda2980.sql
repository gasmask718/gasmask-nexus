
CREATE TABLE public.unforgettable_ambassadors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  phone text,
  state text,
  referral_code text UNIQUE,
  tier text NOT NULL DEFAULT 'starter',
  commission_rate numeric NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'pending',
  total_earnings numeric NOT NULL DEFAULT 0,
  total_sales numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'unforgettable_times',
  business_unit text NOT NULL DEFAULT 'unforgettable_times',
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid
);

CREATE INDEX idx_ut_amb_status ON public.unforgettable_ambassadors(status);
CREATE INDEX idx_ut_amb_email ON public.unforgettable_ambassadors(email);
CREATE INDEX idx_ut_amb_referral ON public.unforgettable_ambassadors(referral_code);

ALTER TABLE public.unforgettable_ambassadors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read UT ambassadors"
  ON public.unforgettable_ambassadors FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update UT ambassadors"
  ON public.unforgettable_ambassadors FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Anyone can insert UT ambassador applications"
  ON public.unforgettable_ambassadors FOR INSERT TO anon, authenticated WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.unforgettable_ambassadors;
