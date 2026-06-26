
-- Preferences
CREATE TABLE IF NOT EXISTS public.admin_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'both')),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (admin_user_id, event_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_notification_preferences TO authenticated;
GRANT ALL ON public.admin_notification_preferences TO service_role;

ALTER TABLE public.admin_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage own notification prefs"
ON public.admin_notification_preferences FOR ALL
TO authenticated
USING (admin_user_id = auth.uid())
WITH CHECK (admin_user_id = auth.uid());

-- Log
CREATE TABLE IF NOT EXISTS public.admin_notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  related_id UUID,
  related_table TEXT,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  body TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'suppressed')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_notifications_log TO authenticated;
GRANT ALL ON public.admin_notifications_log TO service_role;

ALTER TABLE public.admin_notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view admin notification log"
ON public.admin_notifications_log FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE INDEX IF NOT EXISTS idx_admin_notif_log_event_type ON public.admin_notifications_log(event_type);
CREATE INDEX IF NOT EXISTS idx_admin_notif_log_sent_at  ON public.admin_notifications_log(sent_at DESC);
