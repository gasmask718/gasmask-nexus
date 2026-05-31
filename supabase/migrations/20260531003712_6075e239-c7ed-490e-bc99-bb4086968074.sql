
-- 1. Add webhook-tracking columns where missing
ALTER TABLE public.dc_phone_numbers
  ADD COLUMN IF NOT EXISTS twilio_webhook_configured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sms_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS assigned_va_id UUID;

ALTER TABLE public.brandaro_phone_numbers
  ADD COLUMN IF NOT EXISTS twilio_webhook_configured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS twilio_webhook_configured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voice_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS sms_webhook_url TEXT;

ALTER TABLE public.dynasty_phone_numbers
  ADD COLUMN IF NOT EXISTS twilio_sid TEXT,
  ADD COLUMN IF NOT EXISTS twilio_webhook_configured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS twilio_webhook_configured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voice_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS sms_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS assigned_agent_id TEXT,
  ADD COLUMN IF NOT EXISTS assigned_va_id UUID;

ALTER TABLE public.business_phone_numbers
  ADD COLUMN IF NOT EXISTS twilio_sid TEXT,
  ADD COLUMN IF NOT EXISTS twilio_webhook_configured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS twilio_webhook_configured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voice_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS sms_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS assigned_agent_id TEXT,
  ADD COLUMN IF NOT EXISTS assigned_va_id UUID;

-- 2. Canonical phone directory view (single source of truth for comms code)
DROP VIEW IF EXISTS public.v_phone_directory CASCADE;

CREATE VIEW public.v_phone_directory AS
SELECT
  d.id,
  d.phone_number               AS phone_e164,
  COALESCE(NULLIF(d.business,''), 'dynasty-connect') AS business,
  'twilio'::text               AS provider,
  d.assigned_agent_id,
  CASE
    WHEN d.elevenlabs_phone_id IS NOT NULL OR d.elevenlabs_agent_name IS NOT NULL THEN 'elevenlabs'
    WHEN d.is_ai_number THEN 'bland'
    ELSE 'manual'
  END                          AS agent_provider,
  d.webhook_url                AS voice_webhook_url,
  d.sms_webhook_url,
  d.assigned_va_id,
  d.twilio_sid,
  d.twilio_webhook_configured,
  d.twilio_webhook_configured_at,
  d.is_active,
  'dc_phone_numbers'::text     AS source_table
FROM public.dc_phone_numbers d

UNION ALL

SELECT
  b.id,
  b.phone_number,
  'brandaro',
  'twilio',
  NULL::text,
  'manual',
  b.voice_webhook_url,
  b.sms_webhook_url,
  b.assigned_va_id,
  b.twilio_sid,
  b.twilio_webhook_configured,
  b.twilio_webhook_configured_at,
  b.is_active,
  'brandaro_phone_numbers'
FROM public.brandaro_phone_numbers b

UNION ALL

SELECT
  y.id,
  y.phone_number,
  'dynasty',
  'twilio',
  y.assigned_agent_id,
  'manual',
  y.voice_webhook_url,
  y.sms_webhook_url,
  y.assigned_va_id,
  y.twilio_sid,
  y.twilio_webhook_configured,
  y.twilio_webhook_configured_at,
  y.is_active,
  'dynasty_phone_numbers'
FROM public.dynasty_phone_numbers y

UNION ALL

SELECT
  bp.id,
  bp.phone_number,
  COALESCE(bp.business_id::text, 'business'),
  COALESCE(bp.provider, 'twilio'),
  bp.assigned_agent_id,
  'manual',
  bp.voice_webhook_url,
  bp.sms_webhook_url,
  bp.assigned_va_id,
  bp.twilio_sid,
  bp.twilio_webhook_configured,
  bp.twilio_webhook_configured_at,
  bp.is_active,
  'business_phone_numbers'
FROM public.business_phone_numbers bp;

-- Enrich with voice_ops assignments (latest active assignment per phone_number_id)
COMMENT ON VIEW public.v_phone_directory IS
  'Canonical phone directory unioning dc/brandaro/dynasty/business phone tables. Single source of truth for comms code. voice_ops_number_assignments joins via id when needed.';

GRANT SELECT ON public.v_phone_directory TO authenticated, service_role;
