
-- Solar Follow-ups table
CREATE TABLE public.solar_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.solar_leads(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'sms',
  status TEXT NOT NULL DEFAULT 'pending',
  send_time TIMESTAMPTZ NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Solar Appointments table
CREATE TABLE public.solar_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.solar_leads(id) ON DELETE CASCADE NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  agent_id TEXT,
  partner_id UUID REFERENCES public.solar_partners(id),
  status TEXT NOT NULL DEFAULT 'scheduled',
  meeting_link TEXT,
  notes TEXT,
  reminder_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Solar Notifications table
CREATE TABLE public.solar_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.solar_leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  seen BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.solar_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage solar_followups" ON public.solar_followups FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage solar_appointments" ON public.solar_appointments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage solar_notifications" ON public.solar_notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_solar_followups_lead ON public.solar_followups(lead_id);
CREATE INDEX idx_solar_followups_status ON public.solar_followups(status, send_time);
CREATE INDEX idx_solar_appointments_lead ON public.solar_appointments(lead_id);
CREATE INDEX idx_solar_appointments_status ON public.solar_appointments(status, scheduled_time);
CREATE INDEX idx_solar_notifications_seen ON public.solar_notifications(seen, created_at);
