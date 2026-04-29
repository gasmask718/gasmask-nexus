
-- ============ outbound_call_queue: hardening fields ============
ALTER TABLE public.outbound_call_queue
  ADD COLUMN IF NOT EXISTS call_session_id uuid,
  ADD COLUMN IF NOT EXISTS answered_by text,
  ADD COLUMN IF NOT EXISTS dial_status text,
  ADD COLUMN IF NOT EXISTS bridge_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS bridge_failed_reason text,
  ADD COLUMN IF NOT EXISTS voicemail_left boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_error_severity text;

CREATE INDEX IF NOT EXISTS idx_ocq_call_session_id
  ON public.outbound_call_queue(call_session_id);

-- Backfill call_session_id for existing rows (one per row; idempotent because
-- it only fills nulls).
UPDATE public.outbound_call_queue
   SET call_session_id = gen_random_uuid()
 WHERE call_session_id IS NULL;

-- Replace the restrictive status check constraint with the full set we now use.
ALTER TABLE public.outbound_call_queue
  DROP CONSTRAINT IF EXISTS outbound_call_queue_status_check;

ALTER TABLE public.outbound_call_queue
  ADD CONSTRAINT outbound_call_queue_status_check
  CHECK (status IN (
    'queued',
    'dialing',
    'ringing',
    'intro_playing',
    'awaiting_input',
    'answered',
    'connected',
    'voicemail',
    'voicemail_detected',
    'voicemail_left',
    'no_answer',
    'no_input',
    'declined',
    'bridging',
    'bridged',
    'in_ai_conversation',
    'transferred',
    'failed_bridge',
    'failed',
    'completed'
  ));

-- ============ dialer_call_events: severity + dedupe + session ============
ALTER TABLE public.dialer_call_events
  ADD COLUMN IF NOT EXISTS call_session_id uuid,
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS dedupe_key text;

ALTER TABLE public.dialer_call_events
  DROP CONSTRAINT IF EXISTS dialer_call_events_severity_check;
ALTER TABLE public.dialer_call_events
  ADD CONSTRAINT dialer_call_events_severity_check
  CHECK (severity IN ('info','warning','error','critical'));

CREATE INDEX IF NOT EXISTS idx_dce_call_session_id
  ON public.dialer_call_events(call_session_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dce_dedupe_key
  ON public.dialer_call_events(dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- ============ dialer_webhook_events: idempotency ledger ============
CREATE TABLE IF NOT EXISTS public.dialer_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,            -- 'twilio' | 'bland'
  external_id text NOT NULL,         -- CallSid, RecordingSid, bland call_id, etc
  event_type text NOT NULL,
  call_session_id uuid,
  call_sid text,
  bland_call_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_dwe_provider_external UNIQUE (provider, external_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_dwe_session ON public.dialer_webhook_events(call_session_id);
CREATE INDEX IF NOT EXISTS idx_dwe_call_sid ON public.dialer_webhook_events(call_sid);

ALTER TABLE public.dialer_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role full access on dialer_webhook_events" ON public.dialer_webhook_events;
CREATE POLICY "service_role full access on dialer_webhook_events"
  ON public.dialer_webhook_events
  TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated read dialer_webhook_events" ON public.dialer_webhook_events;
CREATE POLICY "Authenticated read dialer_webhook_events"
  ON public.dialer_webhook_events
  FOR SELECT
  TO authenticated
  USING (true);

-- ============ dialer_campaigns: throughput + voicemail config ============
ALTER TABLE public.dialer_campaigns
  ADD COLUMN IF NOT EXISTS cps_limit integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS dispatch_jitter_ms integer NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS voicemail_action text NOT NULL DEFAULT 'hangup',
  ADD COLUMN IF NOT EXISTS voicemail_message text,
  ADD COLUMN IF NOT EXISTS requeue_on_failed_bridge boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bridge_timeout_seconds integer NOT NULL DEFAULT 15;

ALTER TABLE public.dialer_campaigns
  DROP CONSTRAINT IF EXISTS dialer_campaigns_voicemail_action_check;
ALTER TABLE public.dialer_campaigns
  ADD CONSTRAINT dialer_campaigns_voicemail_action_check
  CHECK (voicemail_action IN ('hangup','leave_message'));
