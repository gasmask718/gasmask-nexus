
-- ============================================================
-- DIALER V2 UPGRADE: Phase 1 + 2 + 7
-- ============================================================

-- 1. Attempt state enum
CREATE TYPE public.dialer_attempt_state AS ENUM (
  'queued', 'claimed', 'dialing_target', 'answered_human', 'answered_machine',
  'dialing_agent', 'bridged', 'completed', 'failed', 'blocked', 'agent_missed'
);

-- 2. AMD result enum
CREATE TYPE public.dialer_amd_result AS ENUM ('human', 'machine', 'unknown');

-- 3. Agent routing type enum
CREATE TYPE public.agent_route_type AS ENUM ('browser', 'forward');

-- 4. Add routing fields to dialer_agent_availability
ALTER TABLE public.dialer_agent_availability
  ADD COLUMN IF NOT EXISTS phone_route_type public.agent_route_type NOT NULL DEFAULT 'browser',
  ADD COLUMN IF NOT EXISTS forward_phone_e164 text NULL,
  ADD COLUMN IF NOT EXISTS last_ready_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS current_session_id uuid NULL;

-- 5. Create dialer_call_attempts (per-attempt audit ledger)
CREATE TABLE public.dialer_call_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  campaign_id uuid NULL REFERENCES public.dialer_campaigns(id),
  queue_item_id uuid NULL,
  store_id uuid NULL,
  entity_id uuid NULL,
  target_phone_e164 text NOT NULL,
  agent_user_id uuid NULL,
  engine_run_id uuid NULL,
  attempt_state public.dialer_attempt_state NOT NULL DEFAULT 'queued',
  amd_result public.dialer_amd_result NULL,
  target_call_sid text NULL,
  agent_call_sid text NULL,
  conference_sid text NULL,
  conference_name text NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  target_answered_at timestamptz NULL,
  agent_answered_at timestamptz NULL,
  bridged_at timestamptz NULL,
  ended_at timestamptz NULL,
  duration_seconds integer NULL,
  outcome_code text NULL,
  blocked_reason text NULL,
  recording_url text NULL,
  transcript_url text NULL,
  whisper_played boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dialer_attempts_biz_started ON public.dialer_call_attempts (business_id, started_at DESC);
CREATE INDEX idx_dialer_attempts_store ON public.dialer_call_attempts (store_id, started_at DESC);
CREATE INDEX idx_dialer_attempts_campaign ON public.dialer_call_attempts (campaign_id, started_at DESC);
CREATE INDEX idx_dialer_attempts_active ON public.dialer_call_attempts (business_id) WHERE ended_at IS NULL;
CREATE UNIQUE INDEX idx_dialer_attempts_target_sid ON public.dialer_call_attempts (target_call_sid) WHERE target_call_sid IS NOT NULL;

ALTER TABLE public.dialer_call_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read attempts"
  ON public.dialer_call_attempts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert attempts"
  ON public.dialer_call_attempts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update attempts"
  ON public.dialer_call_attempts FOR UPDATE TO authenticated USING (true);

-- 6. Create contact_compliance table
CREATE TABLE public.contact_compliance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  entity_type text NOT NULL DEFAULT 'store',
  entity_id uuid NOT NULL,
  phone_e164 text NOT NULL,
  dnc boolean NOT NULL DEFAULT false,
  dnc_source text NULL,
  dnc_reason text NULL,
  consent_status text NOT NULL DEFAULT 'unknown',
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, entity_type, entity_id, phone_e164)
);

CREATE INDEX idx_contact_compliance_phone ON public.contact_compliance (phone_e164, business_id);
CREATE INDEX idx_contact_compliance_dnc ON public.contact_compliance (business_id) WHERE dnc = true;

ALTER TABLE public.contact_compliance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read compliance"
  ON public.contact_compliance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert compliance"
  ON public.contact_compliance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update compliance"
  ON public.contact_compliance FOR UPDATE TO authenticated USING (true);

-- 7. Whisper settings
ALTER TABLE public.dialer_settings
  ADD COLUMN IF NOT EXISTS whisper_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS whisper_template text DEFAULT 'Connected: {{contact_name}}, {{store_name}}. Last order: {{last_order_date}}.';

-- 8. Realtime for attempt events
ALTER PUBLICATION supabase_realtime ADD TABLE public.dialer_call_attempts;

-- 9. Trigger for contact_compliance updated_at
CREATE OR REPLACE FUNCTION public.update_contact_compliance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_contact_compliance_updated
  BEFORE UPDATE ON public.contact_compliance
  FOR EACH ROW EXECUTE FUNCTION public.update_contact_compliance_updated_at();
