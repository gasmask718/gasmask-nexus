
-- SMS Recipients table
CREATE TABLE IF NOT EXISTS public.sbo_sms_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  name text NOT NULL,
  phone_number text NOT NULL UNIQUE,
  active boolean DEFAULT true,
  group_tag text DEFAULT 'all',
  notes text,
  last_sent_at timestamptz,
  total_sends int DEFAULT 0
);

ALTER TABLE public.sbo_sms_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to sbo_sms_recipients" ON public.sbo_sms_recipients FOR ALL USING (true) WITH CHECK (true);

-- SMS Sends Log table
CREATE TABLE IF NOT EXISTS public.sbo_sms_sends_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at timestamptz DEFAULT now(),
  recipient_count int,
  message_preview text,
  picks_included int,
  send_type text DEFAULT 'manual',
  status text DEFAULT 'sent',
  error_message text
);

ALTER TABLE public.sbo_sms_sends_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to sbo_sms_sends_log" ON public.sbo_sms_sends_log FOR ALL USING (true) WITH CHECK (true);
