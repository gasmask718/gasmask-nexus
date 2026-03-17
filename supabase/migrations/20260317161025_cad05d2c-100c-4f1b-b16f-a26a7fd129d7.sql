
-- Call Intelligence: insights extracted from calls
CREATE TABLE public.brandaro_call_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_log_id UUID REFERENCES public.brandaro_call_logs(id) ON DELETE CASCADE,
  lead_id UUID,
  objections TEXT[] DEFAULT '{}',
  intent_level TEXT DEFAULT 'unknown',
  services_requested TEXT[] DEFAULT '{}',
  business_type TEXT,
  urgency TEXT DEFAULT 'low',
  sentiment TEXT DEFAULT 'neutral',
  key_phrases TEXT[] DEFAULT '{}',
  closing_angle TEXT,
  ai_summary TEXT,
  ai_recommended_next TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_call_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on brandaro_call_insights"
  ON public.brandaro_call_insights FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read brandaro_call_insights"
  ON public.brandaro_call_insights FOR SELECT TO authenticated USING (true);

-- Call transcripts storage
CREATE TABLE public.brandaro_call_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_log_id UUID REFERENCES public.brandaro_call_logs(id) ON DELETE CASCADE,
  lead_id UUID,
  transcript_text TEXT,
  duration_seconds INTEGER,
  recording_url TEXT,
  transcription_source TEXT DEFAULT 'twilio',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_call_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on brandaro_call_transcripts"
  ON public.brandaro_call_transcripts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read brandaro_call_transcripts"
  ON public.brandaro_call_transcripts FOR SELECT TO authenticated USING (true);

-- Design system: component library + style palettes
CREATE TABLE public.brandaro_design_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_type TEXT NOT NULL,
  variant_name TEXT NOT NULL,
  variant_index INTEGER DEFAULT 0,
  html_template TEXT NOT NULL,
  preview_thumbnail TEXT,
  tags TEXT[] DEFAULT '{}',
  performance_score NUMERIC DEFAULT 0,
  times_used INTEGER DEFAULT 0,
  conversion_rate NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(component_type, variant_name)
);

ALTER TABLE public.brandaro_design_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on brandaro_design_components"
  ON public.brandaro_design_components FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read brandaro_design_components"
  ON public.brandaro_design_components FOR SELECT TO authenticated USING (true);

-- Style palettes for randomization
CREATE TABLE public.brandaro_style_palettes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  palette_name TEXT NOT NULL UNIQUE,
  primary_color TEXT NOT NULL,
  secondary_color TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  bg_color TEXT DEFAULT '#ffffff',
  text_color TEXT DEFAULT '#1a1a1a',
  heading_font TEXT NOT NULL,
  body_font TEXT NOT NULL,
  style_mood TEXT DEFAULT 'professional',
  times_used INTEGER DEFAULT 0,
  avg_quality_score NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_style_palettes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on brandaro_style_palettes"
  ON public.brandaro_style_palettes FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read brandaro_style_palettes"
  ON public.brandaro_style_palettes FOR SELECT TO authenticated USING (true);

-- Add objection_tags to call_logs for VA tagging
ALTER TABLE public.brandaro_call_logs
  ADD COLUMN IF NOT EXISTS objection_tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recording_url TEXT,
  ADD COLUMN IF NOT EXISTS call_duration_seconds INTEGER;

-- Add design tracking to build_jobs
ALTER TABLE public.brandaro_build_jobs
  ADD COLUMN IF NOT EXISTS style_palette_id UUID,
  ADD COLUMN IF NOT EXISTS design_variant_seed INTEGER;
