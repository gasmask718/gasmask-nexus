-- Supplier Messages
CREATE TABLE IF NOT EXISTS public.ut_supplier_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID,
  supplier_name TEXT NOT NULL,
  supplier_email TEXT,
  supplier_whatsapp TEXT,
  direction TEXT NOT NULL,
  channel TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  thread_id TEXT,
  rfq_id UUID,
  is_read BOOLEAN DEFAULT false,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ut_supplier_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.ut_supplier_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Supplier Threads
CREATE TABLE IF NOT EXISTS public.ut_supplier_threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID,
  supplier_name TEXT NOT NULL,
  supplier_email TEXT,
  supplier_whatsapp TEXT,
  rfq_id UUID,
  product_name TEXT,
  subject TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  status TEXT DEFAULT 'active',
  message_count INTEGER DEFAULT 0,
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ut_supplier_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.ut_supplier_threads FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Supplier Quotes (multi-option comparison)
CREATE TABLE IF NOT EXISTS public.ut_supplier_quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rfq_response_id UUID,
  supplier_id UUID,
  supplier_name TEXT,
  product_name TEXT,
  quantity INTEGER,
  product_cost DECIMAL,
  branding_cost DECIMAL,
  option_a_method TEXT,
  option_a_days INTEGER,
  option_a_cost DECIMAL,
  option_a_landed DECIMAL,
  option_b_method TEXT,
  option_b_days INTEGER,
  option_b_cost DECIMAL,
  option_b_landed DECIMAL,
  option_c_method TEXT,
  option_c_days INTEGER,
  option_c_cost DECIMAL,
  option_c_landed DECIMAL,
  selected_option TEXT,
  confirmed_at TIMESTAMPTZ,
  deposit_sent BOOLEAN DEFAULT false,
  deposit_amount DECIMAL,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ut_supplier_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.ut_supplier_quotes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Product Needs
CREATE TABLE IF NOT EXISTS public.ut_product_needs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_name TEXT NOT NULL,
  category TEXT,
  quantity_needed INTEGER,
  target_unit_price DECIMAL,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'searching',
  suppliers_found INTEGER DEFAULT 0,
  outreach_sent INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ut_product_needs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.ut_product_needs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow service_role full access for edge functions
CREATE POLICY "Service role full access messages" ON public.ut_supplier_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access threads" ON public.ut_supplier_threads FOR ALL TO service_role USING (true) WITH CHECK (true);