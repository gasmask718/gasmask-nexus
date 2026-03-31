
-- 1. Add in_use and assigned_va_id to brandaro_phone_numbers
ALTER TABLE brandaro_phone_numbers 
  ADD COLUMN IF NOT EXISTS in_use BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS assigned_va_id UUID REFERENCES profiles(id);

-- 2. VA Sessions
CREATE TABLE va_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  va_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  twilio_number_id UUID NOT NULL REFERENCES brandaro_phone_numbers(id),
  language TEXT NOT NULL DEFAULT 'en',
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

CREATE OR REPLACE FUNCTION validate_va_session_language()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.language NOT IN ('en', 'es') THEN
    RAISE EXCEPTION 'language must be en or es';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_va_sessions_language_check
  BEFORE INSERT OR UPDATE ON va_sessions
  FOR EACH ROW EXECUTE FUNCTION validate_va_session_language();

ALTER TABLE va_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "VAs can manage own sessions" ON va_sessions
  FOR ALL TO authenticated
  USING (va_id = auth.uid())
  WITH CHECK (va_id = auth.uid());

CREATE POLICY "Admins full access to va_sessions" ON va_sessions
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
  );

-- 3. VA Call Logs
CREATE TABLE va_call_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES brandaro_qualified_leads(id),
  va_id UUID NOT NULL REFERENCES profiles(id),
  twilio_number TEXT NOT NULL,
  recording_url TEXT,
  transcript TEXT,
  ai_analysis JSONB,
  duration_seconds INTEGER,
  call_status TEXT DEFAULT 'initiated',
  called_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE va_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "VAs can manage own call logs" ON va_call_logs
  FOR ALL TO authenticated
  USING (va_id = auth.uid())
  WITH CHECK (va_id = auth.uid());

CREATE POLICY "Admins full access to va_call_logs" ON va_call_logs
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
  );

-- 4. VA Invoices
CREATE TABLE va_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES brandaro_qualified_leads(id),
  va_id UUID NOT NULL REFERENCES profiles(id),
  customer_name TEXT NOT NULL,
  service_type TEXT,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'draft',
  payment_link TEXT,
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION validate_va_invoice_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'sent', 'paid', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid invoice status';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_va_invoice_status_check
  BEFORE INSERT OR UPDATE ON va_invoices
  FOR EACH ROW EXECUTE FUNCTION validate_va_invoice_status();

ALTER TABLE va_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "VAs can manage own invoices" ON va_invoices
  FOR ALL TO authenticated
  USING (va_id = auth.uid())
  WITH CHECK (va_id = auth.uid());

CREATE POLICY "Admins full access to va_invoices" ON va_invoices
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
  );

CREATE POLICY "Public can view invoices" ON va_invoices
  FOR SELECT TO anon
  USING (true);

-- 5. VA Invoice Logs
CREATE TABLE va_invoice_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES va_invoices(id) ON DELETE CASCADE,
  sent_via TEXT NOT NULL,
  sent_to TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION validate_va_invoice_log_sent_via()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sent_via NOT IN ('sms', 'email') THEN
    RAISE EXCEPTION 'sent_via must be sms or email';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_va_invoice_log_sent_via_check
  BEFORE INSERT OR UPDATE ON va_invoice_logs
  FOR EACH ROW EXECUTE FUNCTION validate_va_invoice_log_sent_via();

ALTER TABLE va_invoice_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "VAs can manage own invoice logs" ON va_invoice_logs
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM va_invoices WHERE va_invoices.id = va_invoice_logs.invoice_id AND va_invoices.va_id = auth.uid())
  );

CREATE POLICY "Admins full access to va_invoice_logs" ON va_invoice_logs
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
  );

-- 6. Seed phone numbers
INSERT INTO brandaro_phone_numbers (phone_number, friendly_name, brand, is_active, in_use)
VALUES 
  ('+17183089391', 'VA Line 1', 'Brandaro', true, false),
  ('+18776818621', 'VA Line 2', 'Brandaro', true, false)
ON CONFLICT DO NOTHING;
