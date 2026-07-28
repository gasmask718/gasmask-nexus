
-- ═══════════════ VOICE ROUTING SETTINGS ═══════════════
CREATE TABLE public.voice_routing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business text NOT NULL UNIQUE,
  owner_forward_number text,
  ring_model text NOT NULL DEFAULT 'simultaneous',
  va_ring_timeout_seconds integer NOT NULL DEFAULT 20,
  owner_ring_timeout_seconds integer NOT NULL DEFAULT 20,
  hours_timezone text NOT NULL DEFAULT 'America/New_York',
  hours_start_minute integer NOT NULL DEFAULT 540,
  hours_end_minute integer NOT NULL DEFAULT 1200,
  hours_days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6],
  recording_enabled boolean NOT NULL DEFAULT true,
  disclosure_text text NOT NULL DEFAULT 'Thanks for calling. Please note this call may be recorded for quality and training purposes.',
  voicemail_greeting text NOT NULL DEFAULT 'Sorry we missed you. Please leave a message after the tone and we will call you right back.',
  voicemail_enabled boolean NOT NULL DEFAULT true,
  sms_transcript_to_owner boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT voice_routing_ring_model_chk CHECK (ring_model IN ('simultaneous','sequential','owner_first'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_routing_settings TO authenticated;
GRANT ALL ON public.voice_routing_settings TO service_role;
ALTER TABLE public.voice_routing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins manage voice routing settings"
ON public.voice_routing_settings FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'developer')
)
WITH CHECK (
  public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'developer')
);

-- ═══════════════ VA FORWARDING TARGETS ═══════════════
CREATE TABLE public.voice_va_forwarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business text NOT NULL DEFAULT 'gasmask',
  user_id uuid,
  display_name text NOT NULL,
  forward_number text NOT NULL,
  is_available boolean NOT NULL DEFAULT false,
  ring_order integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  last_status_change timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_voice_va_forwarding_business ON public.voice_va_forwarding(business, is_active, is_available);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_va_forwarding TO authenticated;
GRANT ALL ON public.voice_va_forwarding TO service_role;
ALTER TABLE public.voice_va_forwarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins manage VA forwarding"
ON public.voice_va_forwarding FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'developer')
)
WITH CHECK (
  public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'developer')
);

CREATE POLICY "VAs can view their own forwarding entry"
ON public.voice_va_forwarding FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "VAs can toggle their own availability"
ON public.voice_va_forwarding FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ═══════════════ TIMESTAMP TRIGGERS ═══════════════
CREATE OR REPLACE FUNCTION public.voice_routing_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_voice_routing_settings_updated
BEFORE UPDATE ON public.voice_routing_settings
FOR EACH ROW EXECUTE FUNCTION public.voice_routing_touch_updated_at();

CREATE TRIGGER trg_voice_va_forwarding_updated
BEFORE UPDATE ON public.voice_va_forwarding
FOR EACH ROW EXECUTE FUNCTION public.voice_routing_touch_updated_at();

-- ═══════════════ SEED GASMASK CONFIG ═══════════════
INSERT INTO public.voice_routing_settings (business, owner_forward_number, ring_model)
VALUES ('gasmask', '+17183089391', 'simultaneous')
ON CONFLICT (business) DO NOTHING;

-- ═══════════════ VOICEMAIL ACCESS HARDENING ═══════════════
ALTER TABLE public.voicemails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view voicemails" ON public.voicemails;
CREATE POLICY "Staff can view voicemails"
ON public.voicemails FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'developer') OR public.has_role(auth.uid(),'va')
);

DROP POLICY IF EXISTS "Staff can update voicemails" ON public.voicemails;
CREATE POLICY "Staff can update voicemails"
ON public.voicemails FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'developer') OR public.has_role(auth.uid(),'va')
);
