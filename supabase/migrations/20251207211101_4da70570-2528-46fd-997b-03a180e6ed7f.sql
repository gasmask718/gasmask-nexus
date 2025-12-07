
-- Create voice_profiles table for personal and brand voices
CREATE TABLE public.voice_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  voice_type TEXT NOT NULL CHECK (voice_type IN ('personal', 'brand', 'neutral')),
  provider TEXT NOT NULL DEFAULT 'elevenlabs',
  voice_model_id TEXT,
  description TEXT,
  tone_presets JSONB DEFAULT '{}',
  language TEXT DEFAULT 'en',
  is_founder_voice BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.voice_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view voice profiles" ON public.voice_profiles
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create voice profiles" ON public.voice_profiles
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update voice profiles" ON public.voice_profiles
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete voice profiles" ON public.voice_profiles
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Add voice_profile_id to ai_call_logs
ALTER TABLE public.ai_call_logs 
ADD COLUMN IF NOT EXISTS voice_profile_id UUID REFERENCES public.voice_profiles(id),
ADD COLUMN IF NOT EXISTS tone_used TEXT,
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- Create index for faster lookups
CREATE INDEX idx_voice_profiles_business ON public.voice_profiles(business_id);
CREATE INDEX idx_voice_profiles_founder ON public.voice_profiles(is_founder_voice) WHERE is_founder_voice = true;

-- Trigger for updated_at
CREATE TRIGGER update_voice_profiles_updated_at
  BEFORE UPDATE ON public.voice_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default voice profiles
INSERT INTO public.voice_profiles (name, voice_type, voice_model_id, description, tone_presets, is_founder_voice)
VALUES 
  ('Founder Voice', 'personal', 'EXAVITQu4vr4xnSDxMaL', 'Your personal cloned voice for authentic outreach', '{"warm": true, "personal": true}', true),
  ('Professional', 'neutral', 'JBFqnCBsd6RMkjVDRZzb', 'Clean professional tone for business calls', '{"professional": true}', false),
  ('Energetic', 'neutral', 'IKne3meq5aSn9XLyUdCD', 'High-energy enthusiastic voice', '{"energetic": true, "upbeat": true}', false),
  ('Smooth', 'neutral', 'onwK4e9ZLuTAKqWW03F9', 'Calm and smooth delivery', '{"calm": true, "smooth": true}', false);
