
-- Quality Gate + Review Queue

CREATE TABLE IF NOT EXISTS public.brandaro_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_job_id UUID REFERENCES public.brandaro_build_jobs(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.brandaro_clients(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.brandaro_projects(id) ON DELETE SET NULL,
  quality_score INTEGER DEFAULT 0,
  quality_breakdown JSONB DEFAULT '{}',
  issue_reasons TEXT[] DEFAULT '{}',
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending_review', -- pending_review, approved, rejected, rebuild_requested, auto_improved
  assigned_to UUID,
  reviewer_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  auto_retry_count INTEGER DEFAULT 0,
  max_auto_retries INTEGER DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_review_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users manage review queue" ON public.brandaro_review_queue;
CREATE POLICY "Authenticated users manage review queue" ON public.brandaro_review_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add quality columns to build_jobs
ALTER TABLE public.brandaro_build_jobs ADD COLUMN IF NOT EXISTS quality_score INTEGER;
ALTER TABLE public.brandaro_build_jobs ADD COLUMN IF NOT EXISTS quality_breakdown JSONB DEFAULT '{}';
ALTER TABLE public.brandaro_build_jobs ADD COLUMN IF NOT EXISTS deployment_decision TEXT; -- auto_deployed, review_recommended, needs_review
ALTER TABLE public.brandaro_build_jobs ADD COLUMN IF NOT EXISTS auto_retry_count INTEGER DEFAULT 0;
ALTER TABLE public.brandaro_build_jobs ADD COLUMN IF NOT EXISTS deployed_at TIMESTAMPTZ;
