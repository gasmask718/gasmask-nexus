
-- Create language_profiles table
CREATE TABLE public.language_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  dialect_code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create personality_profiles table
CREATE TABLE public.personality_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  base_tone TEXT NOT NULL DEFAULT 'professional',
  formality TEXT NOT NULL DEFAULT 'neutral',
  emoji_style TEXT DEFAULT 'light',
  slang_level TEXT DEFAULT 'none',
  language_profile_id UUID REFERENCES public.language_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create message_language_detection table
CREATE TABLE public.message_language_detection (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID,
  detected_language TEXT,
  detected_dialect TEXT,
  detected_formality TEXT,
  confidence INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create region_communication_styles table
CREATE TABLE public.region_communication_styles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  boro TEXT,
  neighborhood TEXT,
  recommended_personality_id UUID REFERENCES public.personality_profiles(id),
  default_formality TEXT DEFAULT 'neutral',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create agent_tone_corrections table
CREATE TABLE public.agent_tone_corrections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  message_id UUID,
  previous_tone TEXT,
  corrected_tone TEXT,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add language/personality fields to businesses
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS default_language TEXT DEFAULT 'en',
ADD COLUMN IF NOT EXISTS default_dialect TEXT DEFAULT 'en_standard',
ADD COLUMN IF NOT EXISTS default_personality TEXT DEFAULT 'professional';

-- Add language/personality fields to store_master
ALTER TABLE public.store_master
ADD COLUMN IF NOT EXISTS language_preference TEXT,
ADD COLUMN IF NOT EXISTS dialect_preference TEXT,
ADD COLUMN IF NOT EXISTS formality_level TEXT DEFAULT 'neutral',
ADD COLUMN IF NOT EXISTS preferred_channel TEXT DEFAULT 'sms',
ADD COLUMN IF NOT EXISTS notes_for_tone TEXT,
ADD COLUMN IF NOT EXISTS personality_profile_id UUID REFERENCES public.personality_profiles(id);

-- Add language/personality fields to crm_customers
ALTER TABLE public.crm_customers
ADD COLUMN IF NOT EXISTS language_preference TEXT,
ADD COLUMN IF NOT EXISTS dialect_preference TEXT,
ADD COLUMN IF NOT EXISTS formality_level TEXT DEFAULT 'neutral',
ADD COLUMN IF NOT EXISTS personality_profile_id UUID REFERENCES public.personality_profiles(id);

-- Add language_profile_id to voice_personas
ALTER TABLE public.voice_personas
ADD COLUMN IF NOT EXISTS language_profile_id UUID REFERENCES public.language_profiles(id);

-- Add language/personality to ai_agents
ALTER TABLE public.ai_agents
ADD COLUMN IF NOT EXISTS default_personality_profile_id UUID REFERENCES public.personality_profiles(id),
ADD COLUMN IF NOT EXISTS default_language_profile_id UUID REFERENCES public.language_profiles(id);

-- Enable RLS on new tables
ALTER TABLE public.language_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personality_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_language_detection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.region_communication_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tone_corrections ENABLE ROW LEVEL SECURITY;

-- RLS policies for language_profiles (readable by all authenticated)
CREATE POLICY "Language profiles are viewable by authenticated users" 
ON public.language_profiles FOR SELECT TO authenticated USING (true);

-- RLS policies for personality_profiles
CREATE POLICY "Personality profiles are viewable by authenticated users" 
ON public.personality_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Personality profiles are manageable by authenticated users" 
ON public.personality_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS policies for message_language_detection
CREATE POLICY "Message language detection viewable by authenticated users" 
ON public.message_language_detection FOR SELECT TO authenticated USING (true);

CREATE POLICY "Message language detection manageable by authenticated users" 
ON public.message_language_detection FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS policies for region_communication_styles
CREATE POLICY "Region styles viewable by authenticated users" 
ON public.region_communication_styles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Region styles manageable by authenticated users" 
ON public.region_communication_styles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS policies for agent_tone_corrections
CREATE POLICY "Tone corrections viewable by authenticated users" 
ON public.agent_tone_corrections FOR SELECT TO authenticated USING (true);

CREATE POLICY "Tone corrections manageable by authenticated users" 
ON public.agent_tone_corrections FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed default language profiles
INSERT INTO public.language_profiles (code, dialect_code, name, description, is_default) VALUES
('en', 'en_standard', 'English - Standard', 'Standard American English', true),
('en', 'en_nyc', 'English - NYC', 'New York City English dialect', false),
('en', 'en_south', 'English - Southern', 'Southern American English', false),
('es', 'es_standard', 'Spanish - Standard', 'Standard Spanish', false),
('es', 'es_caribbean', 'Spanish - Caribbean', 'Caribbean Spanish (NY/Dominican)', false),
('es', 'es_mexican', 'Spanish - Mexican', 'Mexican Spanish', false),
('zh', 'zh_mandarin', 'Chinese - Mandarin', 'Mandarin Chinese', false),
('ar', 'ar_standard', 'Arabic - Standard', 'Modern Standard Arabic', false),
('bn', 'bn_standard', 'Bengali - Standard', 'Standard Bengali', false),
('ht', 'ht_standard', 'Haitian Creole', 'Haitian Creole', false);

-- Create indexes
CREATE INDEX idx_personality_profiles_business ON public.personality_profiles(business_id);
CREATE INDEX idx_message_lang_detection_message ON public.message_language_detection(message_id);
CREATE INDEX idx_region_styles_boro ON public.region_communication_styles(boro);
CREATE INDEX idx_agent_tone_corrections_agent ON public.agent_tone_corrections(agent_id);
