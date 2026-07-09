
-- funding_tasks
CREATE TABLE public.funding_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.funding_clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date TIMESTAMPTZ,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.funding_tasks TO authenticated;
GRANT ALL ON public.funding_tasks TO service_role;

ALTER TABLE public.funding_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view funding tasks"
  ON public.funding_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert funding tasks"
  ON public.funding_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update funding tasks"
  ON public.funding_tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete funding tasks"
  ON public.funding_tasks FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_funding_tasks_client ON public.funding_tasks(client_id);
CREATE INDEX idx_funding_tasks_status ON public.funding_tasks(status);
CREATE INDEX idx_funding_tasks_assigned ON public.funding_tasks(assigned_to);

-- funding_daily_briefings
CREATE TABLE public.funding_daily_briefings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  briefing_date DATE NOT NULL DEFAULT CURRENT_DATE,
  briefing_type TEXT NOT NULL DEFAULT 'morning',
  summary TEXT,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_commentary TEXT,
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.funding_daily_briefings TO authenticated;
GRANT ALL ON public.funding_daily_briefings TO service_role;

ALTER TABLE public.funding_daily_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view funding briefings"
  ON public.funding_daily_briefings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert funding briefings"
  ON public.funding_daily_briefings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update funding briefings"
  ON public.funding_daily_briefings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete funding briefings"
  ON public.funding_daily_briefings FOR DELETE TO authenticated USING (true);

CREATE UNIQUE INDEX idx_funding_briefings_date_type
  ON public.funding_daily_briefings(briefing_date, briefing_type);

-- Shared updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_funding_tasks_updated_at
  BEFORE UPDATE ON public.funding_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_funding_daily_briefings_updated_at
  BEFORE UPDATE ON public.funding_daily_briefings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
