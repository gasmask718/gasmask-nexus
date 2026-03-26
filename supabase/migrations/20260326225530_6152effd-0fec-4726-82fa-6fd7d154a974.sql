
-- ═══════════════════════════════════════
-- AI BUSINESS BUILDER ENGINE SCHEMA
-- ═══════════════════════════════════════

-- 1) AI Ingestion Jobs
CREATE TABLE public.ut_ai_ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  input_type TEXT NOT NULL CHECK (input_type IN ('pdf','image','url','text','csv')),
  file_url TEXT,
  raw_content TEXT,
  extracted_content JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) AI Extracted Data
CREATE TABLE public.ut_ai_extracted_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingestion_job_id UUID REFERENCES public.ut_ai_ingestion_jobs(id) ON DELETE CASCADE NOT NULL,
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  data_type TEXT NOT NULL CHECK (data_type IN ('menu','menu_item','package','theme','offering','inventory_item','pricing')),
  extracted_data JSONB NOT NULL DEFAULT '{}',
  confidence_score NUMERIC(3,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','rejected','applied')),
  applied_to_id UUID,
  applied_to_table TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) AI Suggestions
CREATE TABLE public.ut_ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('missing_info','pricing','upsell','media','content','package','optimization')),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','dismissed','completed')),
  action_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) AI Generated Listings
CREATE TABLE public.ut_ai_generated_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  listing_type TEXT NOT NULL DEFAULT 'general',
  ai_title TEXT,
  ai_description TEXT,
  ai_highlights JSONB DEFAULT '[]',
  ai_tags JSONB DEFAULT '[]',
  ai_seo_copy TEXT,
  estimated_event_value NUMERIC(12,2),
  upsell_score NUMERIC(3,2) DEFAULT 0,
  profit_score NUMERIC(3,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_ut_ai_ingestion_partner ON public.ut_ai_ingestion_jobs(partner_id);
CREATE INDEX idx_ut_ai_ingestion_status ON public.ut_ai_ingestion_jobs(status);
CREATE INDEX idx_ut_ai_extracted_job ON public.ut_ai_extracted_data(ingestion_job_id);
CREATE INDEX idx_ut_ai_extracted_partner ON public.ut_ai_extracted_data(partner_id);
CREATE INDEX idx_ut_ai_suggestions_partner ON public.ut_ai_suggestions(partner_id);
CREATE INDEX idx_ut_ai_suggestions_status ON public.ut_ai_suggestions(status);
CREATE INDEX idx_ut_ai_listings_partner ON public.ut_ai_generated_listings(partner_id);

-- RLS
ALTER TABLE public.ut_ai_ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_ai_extracted_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_ai_generated_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ingestion jobs" ON public.ut_ai_ingestion_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Users manage own extracted data" ON public.ut_ai_extracted_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Users manage own suggestions" ON public.ut_ai_suggestions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Users manage own generated listings" ON public.ut_ai_generated_listings FOR ALL USING (true) WITH CHECK (true);
