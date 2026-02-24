
-- Phase K.1: Voice Provider Settings, Voice Matrix, TTS Events, AI Call Flows

-- 1) Voice TTS provider enum
DO $$ BEGIN
  CREATE TYPE public.voice_tts_provider AS ENUM ('elevenlabs', 'aws_polly');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Voice Provider Settings (per business)
CREATE TABLE IF NOT EXISTS public.voice_provider_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE UNIQUE,
  default_tts_provider voice_tts_provider NOT NULL DEFAULT 'elevenlabs',
  fallback_tts_provider voice_tts_provider NOT NULL DEFAULT 'aws_polly',
  aws_polly_region TEXT DEFAULT 'us-east-1',
  aws_polly_voice_id TEXT DEFAULT 'Matthew',
  elevenlabs_voice_id TEXT,
  enable_streaming_tts BOOLEAN DEFAULT true,
  max_tts_latency_ms INTEGER DEFAULT 1200,
  tts_cache_enabled BOOLEAN DEFAULT true,
  force_provider TEXT DEFAULT 'auto' CHECK (force_provider IN ('auto', 'elevenlabs', 'aws_polly')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_provider_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view voice provider settings" ON public.voice_provider_settings FOR SELECT USING (true);
CREATE POLICY "Auth users can manage voice provider settings" ON public.voice_provider_settings FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_voice_provider_settings_updated_at BEFORE UPDATE ON public.voice_provider_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Voice Matrix (persona per brand/campaign)
CREATE TABLE IF NOT EXISTS public.voice_matrix (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  brand_key TEXT NOT NULL,
  persona_name TEXT NOT NULL,
  elevenlabs_voice_id TEXT,
  elevenlabs_agent_id TEXT,
  aws_voice_id TEXT DEFAULT 'Matthew',
  speaking_style JSONB DEFAULT '{"pace": "normal", "warmth": 0.7, "confidence": 0.8, "friendliness": 0.8}'::jsonb,
  language_code TEXT DEFAULT 'en-US',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_matrix ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view voice matrix" ON public.voice_matrix FOR SELECT USING (true);
CREATE POLICY "Auth users can manage voice matrix" ON public.voice_matrix FOR ALL USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_voice_matrix_business ON public.voice_matrix(business_id);
CREATE INDEX idx_voice_matrix_brand ON public.voice_matrix(brand_key);

CREATE TRIGGER update_voice_matrix_updated_at BEFORE UPDATE ON public.voice_matrix
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) TTS Events (audit every synthesis call)
CREATE TABLE IF NOT EXISTS public.tts_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  ai_call_session_id UUID,
  provider voice_tts_provider NOT NULL,
  persona_id UUID REFERENCES public.voice_matrix(id) ON DELETE SET NULL,
  text_hash TEXT,
  characters_count INTEGER DEFAULT 0,
  latency_ms INTEGER,
  success BOOLEAN DEFAULT true,
  was_fallback BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tts_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view tts events" ON public.tts_events FOR SELECT USING (true);
CREATE POLICY "Auth users can insert tts events" ON public.tts_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX idx_tts_events_session ON public.tts_events(ai_call_session_id);
CREATE INDEX idx_tts_events_provider ON public.tts_events(provider);
CREATE INDEX idx_tts_events_created ON public.tts_events(created_at DESC);

-- 5) AI Call Flows (structured script trees)
CREATE TABLE IF NOT EXISTS public.ai_call_flows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  flow_name TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  nodes JSONB DEFAULT '[]'::jsonb,
  extraction_schema JSONB DEFAULT '{}'::jsonb,
  escalation_rules JSONB DEFAULT '{"confidence_threshold": 0.4, "escalate_on_keywords": ["speak to manager", "talk to human", "real person"], "max_failed_extractions": 3}'::jsonb,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_call_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view ai call flows" ON public.ai_call_flows FOR SELECT USING (true);
CREATE POLICY "Auth users can manage ai call flows" ON public.ai_call_flows FOR ALL USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_ai_call_flows_business ON public.ai_call_flows(business_id);

CREATE TRIGGER update_ai_call_flows_updated_at BEFORE UPDATE ON public.ai_call_flows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Add voice_matrix_id to ai_call_sessions for tracking which persona was used
ALTER TABLE public.ai_call_sessions
  ADD COLUMN IF NOT EXISTS voice_matrix_id UUID REFERENCES public.voice_matrix(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tts_provider_used TEXT,
  ADD COLUMN IF NOT EXISTS tts_fallback_triggered BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_call_flow_id UUID REFERENCES public.ai_call_flows(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conversation_structured_data JSONB DEFAULT '{}'::jsonb;

-- 7) TTS provider performance view
CREATE OR REPLACE VIEW public.v_tts_provider_stats AS
SELECT
  business_id,
  provider,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE success = true) as successful,
  COUNT(*) FILTER (WHERE success = false) as failed,
  COUNT(*) FILTER (WHERE was_fallback = true) as fallback_count,
  ROUND(AVG(latency_ms)::numeric, 0) as avg_latency_ms,
  ROUND(AVG(latency_ms) FILTER (WHERE success = true)::numeric, 0) as avg_success_latency_ms,
  SUM(characters_count) as total_characters,
  ROUND((COUNT(*) FILTER (WHERE success = true)::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100, 1) as success_rate
FROM public.tts_events
GROUP BY business_id, provider;

-- 8) Seed default voice matrix entries
INSERT INTO public.voice_matrix (brand_key, persona_name, elevenlabs_voice_id, aws_voice_id, speaking_style, language_code)
VALUES
  ('gasmask', 'Gasmask Sales', 'JBFqnCBsd6RMkjVDRZzb', 'Matthew', '{"pace": "confident", "warmth": 0.6, "confidence": 0.9, "friendliness": 0.7}', 'en-US'),
  ('hotmama', 'Hot Mama Friendly', 'EXAVITQu4vr4xnSDxMaL', 'Joanna', '{"pace": "warm", "warmth": 0.9, "confidence": 0.7, "friendliness": 0.95}', 'en-US'),
  ('toptier', 'Top Tier Pro', 'onwK4e9ZLuTAKqWW03F9', 'Matthew', '{"pace": "professional", "warmth": 0.5, "confidence": 0.95, "friendliness": 0.6}', 'en-US'),
  ('default', 'Default Voice', 'JBFqnCBsd6RMkjVDRZzb', 'Matthew', '{"pace": "normal", "warmth": 0.7, "confidence": 0.8, "friendliness": 0.8}', 'en-US')
ON CONFLICT DO NOTHING;
