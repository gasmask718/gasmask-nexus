
-- ============================================
-- VA Power Dialer Patch — Database Migration
-- ============================================

-- 1. New table: va_voicemail_templates
CREATE TABLE IF NOT EXISTS public.va_voicemail_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  language TEXT NOT NULL CHECK (language IN ('en', 'es')),
  audio_url TEXT NOT NULL,
  label TEXT,
  is_active BOOLEAN DEFAULT true,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.va_voicemail_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view voicemail templates"
  ON public.va_voicemail_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert voicemail templates"
  ON public.va_voicemail_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update voicemail templates"
  ON public.va_voicemail_templates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete voicemail templates"
  ON public.va_voicemail_templates FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. New table: va_dialer_settings (singleton config)
CREATE TABLE IF NOT EXISTS public.va_dialer_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_priority JSONB NOT NULL DEFAULT '["callbacks","hot","new","no_answer","warm","all"]'::jsonb,
  dial_pace_seconds INTEGER NOT NULL DEFAULT 3,
  no_answer_timeout_seconds INTEGER NOT NULL DEFAULT 20,
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.va_dialer_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view dialer settings"
  ON public.va_dialer_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can update dialer settings"
  ON public.va_dialer_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. New table: va_monitor_logs
CREATE TABLE IF NOT EXISTS public.va_monitor_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_log_id UUID REFERENCES public.va_call_logs(id),
  admin_id UUID NOT NULL REFERENCES public.profiles(id),
  mode TEXT CHECK (mode IN ('listen', 'whisper', 'barge')),
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

ALTER TABLE public.va_monitor_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all monitor logs"
  ON public.va_monitor_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert monitor logs"
  ON public.va_monitor_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update monitor logs"
  ON public.va_monitor_logs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Alter va_call_logs — add trend_analysis
ALTER TABLE public.va_call_logs ADD COLUMN IF NOT EXISTS trend_analysis JSONB;

-- 5. Alter va_sessions — add admin pause fields
ALTER TABLE public.va_sessions ADD COLUMN IF NOT EXISTS paused_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.va_sessions ADD COLUMN IF NOT EXISTS pause_reason TEXT;
ALTER TABLE public.va_sessions ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;

-- 6. Seed default dialer settings
INSERT INTO public.va_dialer_settings (queue_priority, dial_pace_seconds, no_answer_timeout_seconds)
VALUES ('["callbacks","hot","new","no_answer","warm","all"]'::jsonb, 3, 20)
ON CONFLICT DO NOTHING;

-- 7. Storage bucket for voicemail templates
INSERT INTO storage.buckets (id, name, public)
VALUES ('voicemail-templates', 'voicemail-templates', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read voicemail templates"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'voicemail-templates');

CREATE POLICY "Admins can upload voicemail templates"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'voicemail-templates' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update voicemail templates"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'voicemail-templates' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete voicemail templates"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'voicemail-templates' AND public.has_role(auth.uid(), 'admin'));

-- 8. Enable realtime on va_call_logs and va_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.va_call_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.va_sessions;
