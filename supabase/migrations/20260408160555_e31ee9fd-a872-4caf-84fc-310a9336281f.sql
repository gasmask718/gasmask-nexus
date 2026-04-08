
-- Extend uben_ambassadors
ALTER TABLE public.uben_ambassadors
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'bronze',
  ADD COLUMN IF NOT EXISTS recruited_by_staff_id UUID,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE;

-- uben_staff_recruiters
CREATE TABLE IF NOT EXISTS public.uben_staff_recruiters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  business_unit TEXT NOT NULL,
  override_rate NUMERIC NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.uben_staff_recruiters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage uben_staff_recruiters" ON public.uben_staff_recruiters
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add FK after table exists
ALTER TABLE public.uben_ambassadors
  ADD CONSTRAINT uben_ambassadors_recruited_by_fkey
  FOREIGN KEY (recruited_by_staff_id) REFERENCES public.uben_staff_recruiters(id) ON DELETE SET NULL;

-- uben_commission_config
CREATE TABLE IF NOT EXISTS public.uben_commission_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_unit TEXT NOT NULL UNIQUE,
  ambassador_commission_rate NUMERIC NOT NULL DEFAULT 10,
  staff_override_rate NUMERIC NOT NULL DEFAULT 2,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.uben_commission_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage uben_commission_config" ON public.uben_commission_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed default config
INSERT INTO public.uben_commission_config (business_unit, ambassador_commission_rate, staff_override_rate) VALUES
  ('Unforgettable Times', 10, 2),
  ('TopTier Experience', 8, 2),
  ('iClean WeClean', 10, 2),
  ('GasMask', 5, 1),
  ('UBEN Programs', 10, 2)
ON CONFLICT (business_unit) DO NOTHING;

-- uben_commission_ledger
CREATE TABLE IF NOT EXISTS public.uben_commission_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ambassador_id UUID REFERENCES public.uben_ambassadors(id) ON DELETE CASCADE NOT NULL,
  business_unit TEXT NOT NULL,
  sale_type TEXT NOT NULL DEFAULT 'Sale',
  sale_amount NUMERIC NOT NULL DEFAULT 0,
  ambassador_commission NUMERIC NOT NULL DEFAULT 0,
  staff_override_amount NUMERIC NOT NULL DEFAULT 0,
  staff_recruiter_id UUID REFERENCES public.uben_staff_recruiters(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.uben_commission_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage uben_commission_ledger" ON public.uben_commission_ledger
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- uben_ambassador_applications
CREATE TABLE IF NOT EXISTS public.uben_ambassador_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  business_unit_interest TEXT,
  referred_by TEXT,
  application_status TEXT NOT NULL DEFAULT 'applied',
  assigned_staff_id UUID REFERENCES public.uben_staff_recruiters(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.uben_ambassador_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage uben_ambassador_applications" ON public.uben_ambassador_applications
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can submit ambassador applications" ON public.uben_ambassador_applications
  FOR INSERT TO anon WITH CHECK (true);
