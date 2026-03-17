
-- Build Jobs table - core of the auto-build pipeline
CREATE TABLE public.brandaro_build_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.brandaro_clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.brandaro_projects(id) ON DELETE SET NULL,
  demo_id UUID REFERENCES public.brandaro_demo_sites(id) ON DELETE SET NULL,
  lead_id UUID,
  build_engine TEXT NOT NULL DEFAULT 'native' CHECK (build_engine IN ('native', 'durable')),
  build_status TEXT NOT NULL DEFAULT 'queued' CHECK (build_status IN ('queued', 'extracting_demo', 'generating_content', 'building', 'deploying', 'quality_check', 'completed', 'failed')),
  progress_stage TEXT DEFAULT 'initialized',
  package_tier TEXT,
  error_log JSONB DEFAULT '[]'::jsonb,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  content_generated BOOLEAN DEFAULT false,
  pages_built INT DEFAULT 0,
  total_pages INT DEFAULT 5,
  deployed_url TEXT,
  domain_connected BOOLEAN DEFAULT false,
  quality_score NUMERIC(5,2),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Content Blocks table - Claude-generated structured content
CREATE TABLE public.brandaro_content_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_job_id UUID REFERENCES public.brandaro_build_jobs(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.brandaro_clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.brandaro_projects(id) ON DELETE SET NULL,
  page_type TEXT NOT NULL CHECK (page_type IN ('homepage', 'services', 'about', 'contact', 'seo_city', 'gallery', 'testimonials', 'faq')),
  section_name TEXT NOT NULL,
  section_order INT DEFAULT 0,
  content_html TEXT,
  content_text TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  seo_title TEXT,
  seo_description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'approved', 'applied', 'rejected')),
  generated_by TEXT DEFAULT 'claude',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add production conversion flags to demo_sites
ALTER TABLE public.brandaro_demo_sites 
  ADD COLUMN IF NOT EXISTS demo_ready_for_conversion BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS production_build_ready BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS extracted_structure JSONB;

-- Add deployment fields to projects
ALTER TABLE public.brandaro_projects
  ADD COLUMN IF NOT EXISTS live_url TEXT,
  ADD COLUMN IF NOT EXISTS deployment_status TEXT DEFAULT 'pending' CHECK (deployment_status IN ('pending', 'deploying', 'active', 'failed')),
  ADD COLUMN IF NOT EXISTS deployed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS domain_type TEXT DEFAULT 'subdomain' CHECK (domain_type IN ('subdomain', 'custom')),
  ADD COLUMN IF NOT EXISTS custom_domain TEXT,
  ADD COLUMN IF NOT EXISTS ssl_provisioned BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS build_job_id UUID;

-- Enable RLS
ALTER TABLE public.brandaro_build_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_content_blocks ENABLE ROW LEVEL SECURITY;

-- RLS policies (service role access for edge functions, authenticated read)
CREATE POLICY "Authenticated users can view build jobs" ON public.brandaro_build_jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view content blocks" ON public.brandaro_content_blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role full access build jobs" ON public.brandaro_build_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access content blocks" ON public.brandaro_content_blocks FOR ALL TO service_role USING (true) WITH CHECK (true);
