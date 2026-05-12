CREATE TABLE IF NOT EXISTS public.bland_sms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.bland_leads(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  message text NOT NULL,
  source text,
  twilio_sid text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bland_sms_log_phone ON public.bland_sms_log(phone_number);
CREATE INDEX IF NOT EXISTS idx_bland_sms_log_created ON public.bland_sms_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bland_sms_log_lead ON public.bland_sms_log(lead_id);

ALTER TABLE public.bland_sms_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read bland_sms_log" ON public.bland_sms_log;
CREATE POLICY "Authenticated read bland_sms_log" ON public.bland_sms_log
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role full bland_sms_log" ON public.bland_sms_log;
CREATE POLICY "Service role full bland_sms_log" ON public.bland_sms_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated insert bland_sms_log" ON public.bland_sms_log;
CREATE POLICY "Authenticated insert bland_sms_log" ON public.bland_sms_log
  FOR INSERT TO authenticated WITH CHECK (true);