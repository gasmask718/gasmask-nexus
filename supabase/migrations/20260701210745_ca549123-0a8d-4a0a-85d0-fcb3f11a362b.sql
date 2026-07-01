
CREATE TABLE public.dc_voicemail_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit_key text NOT NULL
    REFERENCES public.dc_businesses(business_key) ON DELETE CASCADE,
  name text NOT NULL,
  audio_url text NOT NULL,
  transcript text NULL,
  duration_seconds integer NULL,
  voice_talent text NULL,
  language text NOT NULL DEFAULT 'en',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dc_voicemail_templates TO authenticated;
GRANT ALL ON public.dc_voicemail_templates TO service_role;

ALTER TABLE public.dc_voicemail_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY dc_voicemail_templates_select
  ON public.dc_voicemail_templates
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY dc_voicemail_templates_service
  ON public.dc_voicemail_templates
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX idx_dc_voicemail_templates_buk
  ON public.dc_voicemail_templates(business_unit_key)
  WHERE is_active = true;

COMMENT ON TABLE public.dc_voicemail_templates IS
'Pre-recorded voicemail drop audio templates for DC campaigns. Audio hosted externally (Supabase Storage or CDN). Linked to dc_campaigns via voicemail_drop_template_id. Bland plays audio_url when AMD detects answering machine on outbound call.';

CREATE OR REPLACE FUNCTION public.dc_voicemail_templates_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dc_voicemail_templates_updated_at
  BEFORE UPDATE ON public.dc_voicemail_templates
  FOR EACH ROW EXECUTE FUNCTION public.dc_voicemail_templates_touch_updated_at();

ALTER TABLE public.dc_campaigns
  ADD COLUMN IF NOT EXISTS voicemail_drop_template_id uuid
    REFERENCES public.dc_voicemail_templates(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.dc_campaigns.voicemail_drop_template_id IS
'Optional voicemail drop template to play when AMD detects an answering machine. NULL = use agent spoken voicemail script (default behavior, already in agent prompts). Set = play this audio file instead of agent speaking the voicemail.';
