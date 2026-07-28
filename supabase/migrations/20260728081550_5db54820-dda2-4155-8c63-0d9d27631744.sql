ALTER TABLE public.voice_routing_settings
  ADD COLUMN IF NOT EXISTS no_answer_action text NOT NULL DEFAULT 'ai_agent',
  ADD COLUMN IF NOT EXISTS ai_agent_timeout_seconds integer NOT NULL DEFAULT 20;

ALTER TABLE public.voice_routing_settings
  DROP CONSTRAINT IF EXISTS voice_routing_settings_no_answer_action_check;
ALTER TABLE public.voice_routing_settings
  ADD CONSTRAINT voice_routing_settings_no_answer_action_check
  CHECK (no_answer_action IN ('ai_agent','voicemail'));