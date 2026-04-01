
-- 1. New table: va_leaderboard_stats
CREATE TABLE IF NOT EXISTS public.va_leaderboard_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  va_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  calls_dialed INTEGER DEFAULT 0,
  calls_answered INTEGER DEFAULT 0,
  calls_closed INTEGER DEFAULT 0,
  total_talk_time_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(va_id, session_date)
);

ALTER TABLE public.va_leaderboard_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view leaderboard"
  ON public.va_leaderboard_stats FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "VAs can update own leaderboard stats"
  ON public.va_leaderboard_stats FOR UPDATE
  TO authenticated USING (va_id = auth.uid());

CREATE POLICY "VAs can insert own leaderboard stats"
  ON public.va_leaderboard_stats FOR INSERT
  TO authenticated WITH CHECK (va_id = auth.uid());

CREATE POLICY "Service role full access to leaderboard"
  ON public.va_leaderboard_stats FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Enable realtime for leaderboard
ALTER PUBLICATION supabase_realtime ADD TABLE public.va_leaderboard_stats;

-- 2. New table: dnc_list
CREATE TABLE IF NOT EXISTS public.dnc_list (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL UNIQUE,
  added_by UUID REFERENCES public.profiles(id),
  reason TEXT,
  added_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.dnc_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read DNC list"
  ON public.dnc_list FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert DNC entries"
  ON public.dnc_list FOR INSERT
  TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can delete DNC entries"
  ON public.dnc_list FOR DELETE
  TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Service role full access to DNC"
  ON public.dnc_list FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- 3. New table: va_sms_logs
CREATE TABLE IF NOT EXISTS public.va_sms_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.brandaro_qualified_leads(id),
  va_id UUID NOT NULL REFERENCES public.profiles(id),
  message_body TEXT,
  sent_to TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.va_sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "VAs can view own SMS logs"
  ON public.va_sms_logs FOR SELECT
  TO authenticated USING (va_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "VAs can insert own SMS logs"
  ON public.va_sms_logs FOR INSERT
  TO authenticated WITH CHECK (va_id = auth.uid());

CREATE POLICY "Service role full access to SMS logs"
  ON public.va_sms_logs FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- 4. New table: va_daily_goals
CREATE TABLE IF NOT EXISTS public.va_daily_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  va_id UUID REFERENCES public.profiles(id),
  goal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  calls_target INTEGER DEFAULT 100,
  closes_target INTEGER DEFAULT 10,
  set_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(va_id, goal_date)
);

ALTER TABLE public.va_daily_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view goals"
  ON public.va_daily_goals FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage goals"
  ON public.va_daily_goals FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access to goals"
  ON public.va_daily_goals FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- 5. Alter va_call_logs — add new columns
ALTER TABLE public.va_call_logs
  ADD COLUMN IF NOT EXISTS excitement_level TEXT CHECK (excitement_level IN ('hot','warm','cold')),
  ADD COLUMN IF NOT EXISTS disposition TEXT CHECK (disposition IN ('closed','not_interested','callback','no_answer','voicemail','dnc')),
  ADD COLUMN IF NOT EXISTS voicemail_dropped BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS call_sid TEXT,
  ADD COLUMN IF NOT EXISTS callback_scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS va_notes TEXT;

-- 6. Alter brandaro_qualified_leads — add new columns
ALTER TABLE public.brandaro_qualified_leads
  ADD COLUMN IF NOT EXISTS va_notes TEXT,
  ADD COLUMN IF NOT EXISTS excitement_level TEXT,
  ADD COLUMN IF NOT EXISTS callback_scheduled_at TIMESTAMPTZ;

-- 7. Upsert function for leaderboard stats (used by edge functions)
CREATE OR REPLACE FUNCTION public.upsert_leaderboard_stat(
  p_va_id UUID,
  p_field TEXT,
  p_increment INTEGER DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.va_leaderboard_stats (va_id, session_date)
  VALUES (p_va_id, CURRENT_DATE)
  ON CONFLICT (va_id, session_date) DO NOTHING;

  IF p_field = 'calls_dialed' THEN
    UPDATE public.va_leaderboard_stats SET calls_dialed = calls_dialed + p_increment, updated_at = now() WHERE va_id = p_va_id AND session_date = CURRENT_DATE;
  ELSIF p_field = 'calls_answered' THEN
    UPDATE public.va_leaderboard_stats SET calls_answered = calls_answered + p_increment, updated_at = now() WHERE va_id = p_va_id AND session_date = CURRENT_DATE;
  ELSIF p_field = 'calls_closed' THEN
    UPDATE public.va_leaderboard_stats SET calls_closed = calls_closed + p_increment, updated_at = now() WHERE va_id = p_va_id AND session_date = CURRENT_DATE;
  ELSIF p_field = 'total_talk_time_seconds' THEN
    UPDATE public.va_leaderboard_stats SET total_talk_time_seconds = total_talk_time_seconds + p_increment, updated_at = now() WHERE va_id = p_va_id AND session_date = CURRENT_DATE;
  END IF;
END;
$$;
