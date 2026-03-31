
-- Seed Twilio numbers (idempotent)
INSERT INTO brandaro_phone_numbers (phone_number, friendly_name, in_use, assigned_va_id, brand, is_active)
VALUES 
  ('+17183089391', 'English Line 1', false, NULL, 'Brandaro', true),
  ('+18776818621', 'English Line 2', false, NULL, 'Brandaro', true)
ON CONFLICT (phone_number) DO NOTHING;

-- Enable RLS
ALTER TABLE va_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE va_call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE va_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE va_invoice_logs ENABLE ROW LEVEL SECURITY;

-- va_sessions policies
CREATE POLICY "va_own_sessions" ON va_sessions
  FOR ALL USING (va_id = auth.uid());
CREATE POLICY "admin_full_sessions" ON va_sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- va_call_logs policies
CREATE POLICY "va_own_call_logs" ON va_call_logs
  FOR ALL USING (va_id = auth.uid());
CREATE POLICY "admin_full_call_logs" ON va_call_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- va_invoices policies
CREATE POLICY "va_own_invoices" ON va_invoices
  FOR ALL USING (va_id = auth.uid());
CREATE POLICY "admin_full_invoices" ON va_invoices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- va_invoice_logs policies
CREATE POLICY "va_own_invoice_logs" ON va_invoice_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM va_invoices 
      WHERE va_invoices.id = va_invoice_logs.invoice_id 
      AND va_invoices.va_id = auth.uid()
    )
  );
CREATE POLICY "admin_full_invoice_logs" ON va_invoice_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
