
-- Extracted templates from Durable output for standardization
CREATE TABLE public.brandaro_extracted_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_job_id UUID REFERENCES public.brandaro_build_jobs(id) ON DELETE CASCADE,
  client_id UUID,
  source_engine TEXT NOT NULL DEFAULT 'durable',
  extracted_html TEXT,
  extracted_sections JSONB DEFAULT '[]',
  design_patterns JSONB DEFAULT '{}',
  layout_hierarchy JSONB DEFAULT '{}',
  color_scheme JSONB DEFAULT '{}',
  typography JSONB DEFAULT '{}',
  standardized BOOLEAN DEFAULT false,
  standardized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_extracted_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on brandaro_extracted_templates"
  ON public.brandaro_extracted_templates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated read brandaro_extracted_templates"
  ON public.brandaro_extracted_templates
  FOR SELECT
  TO authenticated
  USING (true);

-- Add hybrid build tracking columns to build_jobs
ALTER TABLE public.brandaro_build_jobs
  ADD COLUMN IF NOT EXISTS initial_engine TEXT,
  ADD COLUMN IF NOT EXISTS final_engine TEXT,
  ADD COLUMN IF NOT EXISTS durable_raw_html TEXT,
  ADD COLUMN IF NOT EXISTS standardization_applied BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS engine_switched BOOLEAN DEFAULT false;
