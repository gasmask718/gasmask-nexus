
-- ============================================================
-- AMBASSADOR FIELD SESSIONS — additive tracking for ambassadors
-- Drivers/bikers tracking is untouched (continues via location_events
-- triggered by active routes/runs). This table represents an
-- explicit, manually-started or run-triggered "I'm in the field"
-- session so we know when an ambassador's location_events should be
-- treated as live tracking and rendered on the ops map.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.field_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('driver','biker','ambassador')),
  trigger_source text NOT NULL DEFAULT 'manual' CHECK (trigger_source IN ('manual','route','visit_run')),
  source_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ended_reason text CHECK (ended_reason IN ('manual','auto_cap','admin','tab_closed') OR ended_reason IS NULL),
  last_ping_at timestamptz,
  last_lat numeric,
  last_lng numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_field_sessions_user_active
  ON public.field_sessions (user_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_field_sessions_role_active
  ON public.field_sessions (role) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_field_sessions_started_at
  ON public.field_sessions (started_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.field_sessions TO authenticated;
GRANT ALL ON public.field_sessions TO service_role;

ALTER TABLE public.field_sessions ENABLE ROW LEVEL SECURITY;

-- Users can see their own sessions
CREATE POLICY "field_sessions_self_select"
  ON public.field_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can start their own sessions
CREATE POLICY "field_sessions_self_insert"
  ON public.field_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update (stop/ping) their own sessions
CREATE POLICY "field_sessions_self_update"
  ON public.field_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin/dispatch read all
CREATE POLICY "field_sessions_admin_select"
  ON public.field_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.primary_role = ANY (ARRAY['admin','owner','ceo','va'])
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY (ARRAY['admin','owner']::app_role[])
    )
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_field_sessions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_field_sessions ON public.field_sessions;
CREATE TRIGGER trg_touch_field_sessions
  BEFORE UPDATE ON public.field_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_field_sessions_updated_at();

-- Auto-close stale sessions (>10h). Idempotent; safe to call from a cron or on read.
CREATE OR REPLACE FUNCTION public.close_stale_field_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  closed integer;
BEGIN
  WITH upd AS (
    UPDATE public.field_sessions
       SET ended_at = LEAST(now(), started_at + interval '10 hours'),
           ended_reason = 'auto_cap'
     WHERE ended_at IS NULL
       AND started_at < now() - interval '10 hours'
    RETURNING 1
  )
  SELECT count(*)::integer INTO closed FROM upd;
  RETURN closed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_stale_field_sessions() TO authenticated, service_role;
