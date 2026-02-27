
-- Add voice provider columns to ai_agents
ALTER TABLE public.ai_agents
ADD COLUMN IF NOT EXISTS voice_provider text DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS voice_mode text DEFAULT 'balanced';

-- Add voice provider columns to ai_call_campaigns
ALTER TABLE public.ai_call_campaigns
ADD COLUMN IF NOT EXISTS voice_provider_override text,
ADD COLUMN IF NOT EXISTS voice_mode_override text;

-- Add voice provider columns to outbound_call_queue
ALTER TABLE public.outbound_call_queue
ADD COLUMN IF NOT EXISTS voice_provider text,
ADD COLUMN IF NOT EXISTS voice_mode text;

-- Add voice_mode to dialer_settings (default_voice_provider already exists)
ALTER TABLE public.dialer_settings
ADD COLUMN IF NOT EXISTS default_voice_mode text DEFAULT 'balanced';
