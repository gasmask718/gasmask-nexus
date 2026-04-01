
CREATE TABLE IF NOT EXISTS public.dc_phone_numbers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  sid TEXT,
  friendly_name TEXT,
  webhook_url TEXT,
  status TEXT DEFAULT 'active',
  is_ai_number BOOLEAN DEFAULT true,
  monthly_cost DECIMAL DEFAULT 1.00,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dc_phone_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view DC phone numbers"
ON public.dc_phone_numbers FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage DC phone numbers"
ON public.dc_phone_numbers FOR ALL TO authenticated USING (true) WITH CHECK (true);
