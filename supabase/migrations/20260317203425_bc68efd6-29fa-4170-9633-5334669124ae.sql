
-- Payment Recovery Sequences table
CREATE TABLE public.brandaro_payment_recovery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.brandaro_closer_sessions(id) ON DELETE CASCADE,
  lead_id UUID,
  step INTEGER NOT NULL DEFAULT 1,
  message_content TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  channel TEXT DEFAULT 'sms',
  recovered BOOLEAN DEFAULT false,
  recovered_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_payment_recovery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage payment recovery" ON public.brandaro_payment_recovery FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Real-time alerts table
CREATE TABLE public.brandaro_closer_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  lead_id UUID,
  session_id UUID,
  title TEXT NOT NULL,
  detail TEXT,
  priority INTEGER DEFAULT 50,
  seen BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_closer_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage closer alerts" ON public.brandaro_closer_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable realtime for alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.brandaro_closer_alerts;

-- Add recovered revenue tracking columns to closer sessions
ALTER TABLE public.brandaro_closer_sessions 
  ADD COLUMN IF NOT EXISTS recovery_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_recovery_at TIMESTAMPTZ;
