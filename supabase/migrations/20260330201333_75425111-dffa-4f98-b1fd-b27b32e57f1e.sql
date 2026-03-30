
-- Add lead assignment fields to brandaro_leads_master
ALTER TABLE public.brandaro_leads_master 
  ADD COLUMN IF NOT EXISTS assigned_va_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'english',
  ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'US';

-- Create VA call notes table for Brandaro
CREATE TABLE IF NOT EXISTS public.brandaro_va_call_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.brandaro_leads_master(id) ON DELETE CASCADE NOT NULL,
  va_id UUID REFERENCES public.profiles(id) NOT NULL,
  summary TEXT NOT NULL,
  objection TEXT,
  next_step TEXT,
  call_duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_va_call_notes ENABLE ROW LEVEL SECURITY;

-- VAs can only see their own notes
CREATE POLICY "VAs see own notes" ON public.brandaro_va_call_notes
  FOR SELECT TO authenticated
  USING (va_id = auth.uid());

CREATE POLICY "VAs insert own notes" ON public.brandaro_va_call_notes
  FOR INSERT TO authenticated
  WITH CHECK (va_id = auth.uid());

-- Admins see all notes
CREATE POLICY "Admins see all notes" ON public.brandaro_va_call_notes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create VA performance tracking view
CREATE TABLE IF NOT EXISTS public.brandaro_va_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  va_id UUID REFERENCES public.profiles(id) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  calls_made INTEGER DEFAULT 0,
  interested_count INTEGER DEFAULT 0,
  forms_sent INTEGER DEFAULT 0,
  deals_closed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(va_id, period_start)
);

ALTER TABLE public.brandaro_va_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "VAs see own performance" ON public.brandaro_va_performance
  FOR SELECT TO authenticated
  USING (va_id = auth.uid());

CREATE POLICY "Admins manage performance" ON public.brandaro_va_performance
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
