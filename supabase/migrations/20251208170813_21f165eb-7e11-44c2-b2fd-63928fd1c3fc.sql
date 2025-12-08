-- Call Intelligence Suite V1 - Recording, Transcripts, Quality Scoring

-- 1. First create manual_call_logs if it doesn't exist
CREATE TABLE IF NOT EXISTS public.manual_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.store_master(id) ON DELETE SET NULL,
  vertical_id UUID REFERENCES public.brand_verticals(id) ON DELETE SET NULL,
  contact_id UUID,
  caller_id UUID,
  phone_number TEXT,
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  status TEXT DEFAULT 'pending',
  outcome TEXT,
  notes TEXT,
  duration_seconds INTEGER,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on manual_call_logs
ALTER TABLE public.manual_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage manual call logs"
  ON public.manual_call_logs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. Call Recordings Table
CREATE TABLE IF NOT EXISTS public.call_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.ai_call_sessions(id) ON DELETE SET NULL,
  manual_call_id UUID REFERENCES public.manual_call_logs(id) ON DELETE SET NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.store_master(id) ON DELETE SET NULL,
  vertical_id UUID REFERENCES public.brand_verticals(id) ON DELETE SET NULL,
  
  provider TEXT,
  provider_call_sid TEXT,
  recording_url TEXT,
  recording_duration INTEGER,
  channels TEXT DEFAULT 'mono',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  has_transcript BOOLEAN DEFAULT FALSE,
  transcript_path TEXT,
  language TEXT DEFAULT 'en',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Call Analytics Table
CREATE TABLE IF NOT EXISTS public.call_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES public.call_recordings(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.ai_call_sessions(id) ON DELETE SET NULL,
  manual_call_id UUID REFERENCES public.manual_call_logs(id) ON DELETE SET NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.store_master(id) ON DELETE SET NULL,
  vertical_id UUID REFERENCES public.brand_verticals(id) ON DELETE SET NULL,
  
  transcript TEXT,
  summary TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  sentiment_score NUMERIC(5,2),
  
  tags TEXT[] DEFAULT '{}',
  objections TEXT[] DEFAULT '{}',
  promises TEXT[] DEFAULT '{}',
  next_steps TEXT[] DEFAULT '{}',
  key_moments JSONB DEFAULT '[]',
  duration_seconds INTEGER,
  
  ai_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Call Quality Scores Table
CREATE TABLE IF NOT EXISTS public.call_quality_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES public.call_recordings(id) ON DELETE CASCADE,
  analytics_id UUID REFERENCES public.call_analytics(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.ai_call_sessions(id) ON DELETE SET NULL,
  manual_call_id UUID REFERENCES public.manual_call_logs(id) ON DELETE SET NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.store_master(id) ON DELETE SET NULL,
  vertical_id UUID REFERENCES public.brand_verticals(id) ON DELETE SET NULL,
  
  overall_score NUMERIC(5,2),
  greeting_score NUMERIC(5,2),
  clarity_score NUMERIC(5,2),
  empathy_score NUMERIC(5,2),
  compliance_score NUMERIC(5,2),
  offer_delivery_score NUMERIC(5,2),
  closing_score NUMERIC(5,2),
  
  issues TEXT[] DEFAULT '{}',
  strengths TEXT[] DEFAULT '{}',
  coaching_tips TEXT[] DEFAULT '{}',
  
  is_ai BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_manual_call_logs_store ON public.manual_call_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_manual_call_logs_business ON public.manual_call_logs(business_id);

CREATE INDEX IF NOT EXISTS idx_call_recordings_session ON public.call_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_call_recordings_manual ON public.call_recordings(manual_call_id);
CREATE INDEX IF NOT EXISTS idx_call_recordings_store ON public.call_recordings(store_id);
CREATE INDEX IF NOT EXISTS idx_call_recordings_pending ON public.call_recordings(has_transcript) WHERE has_transcript = FALSE;

CREATE INDEX IF NOT EXISTS idx_call_analytics_recording ON public.call_analytics(recording_id);
CREATE INDEX IF NOT EXISTS idx_call_analytics_store ON public.call_analytics(store_id);
CREATE INDEX IF NOT EXISTS idx_call_analytics_sentiment ON public.call_analytics(sentiment);

CREATE INDEX IF NOT EXISTS idx_call_quality_recording ON public.call_quality_scores(recording_id);
CREATE INDEX IF NOT EXISTS idx_call_quality_store ON public.call_quality_scores(store_id);
CREATE INDEX IF NOT EXISTS idx_call_quality_score ON public.call_quality_scores(overall_score);

-- Enable RLS
ALTER TABLE public.call_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_quality_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can manage call recordings"
  ON public.call_recordings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage call analytics"
  ON public.call_analytics FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage call quality scores"
  ON public.call_quality_scores FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.manual_call_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_recordings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_analytics;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_quality_scores;