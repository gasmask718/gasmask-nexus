
-- uben_ambassadors
CREATE TABLE IF NOT EXISTS public.uben_ambassadors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  business_unit TEXT,
  referral_code TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  total_sales INTEGER NOT NULL DEFAULT 0,
  total_earnings NUMERIC NOT NULL DEFAULT 0,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.uben_ambassadors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users manage uben_ambassadors" ON public.uben_ambassadors
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- uben_ambassador_sales
CREATE TABLE IF NOT EXISTS public.uben_ambassador_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ambassador_id UUID REFERENCES public.uben_ambassadors(id) ON DELETE CASCADE NOT NULL,
  sale_amount NUMERIC NOT NULL DEFAULT 0,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.uben_ambassador_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users manage uben_ambassador_sales" ON public.uben_ambassador_sales
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- uben_activity_log
CREATE TABLE IF NOT EXISTS public.uben_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  actor_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.uben_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users manage uben_activity_log" ON public.uben_activity_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
