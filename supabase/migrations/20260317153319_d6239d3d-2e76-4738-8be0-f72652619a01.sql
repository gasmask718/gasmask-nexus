
-- PHASE 5.5: Result Engine Tables (safe creation)

CREATE TABLE IF NOT EXISTS public.brandaro_lead_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.brandaro_clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.brandaro_projects(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_value TEXT,
  source TEXT DEFAULT 'direct',
  ip_address TEXT,
  user_agent TEXT,
  page_url TEXT,
  session_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brandaro_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.brandaro_clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.brandaro_projects(id) ON DELETE SET NULL,
  caller_phone TEXT,
  tracking_number TEXT,
  duration_seconds INTEGER DEFAULT 0,
  call_outcome TEXT DEFAULT 'unknown',
  call_source TEXT,
  recording_url TEXT,
  twilio_call_sid TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brandaro_client_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.brandaro_clients(id) ON DELETE CASCADE NOT NULL,
  period_date DATE NOT NULL,
  total_visitors INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  leads_generated INTEGER DEFAULT 0,
  calls_generated INTEGER DEFAULT 0,
  form_submissions INTEGER DEFAULT 0,
  cta_clicks INTEGER DEFAULT 0,
  conversion_rate NUMERIC(5,2) DEFAULT 0,
  estimated_revenue_impact NUMERIC(12,2) DEFAULT 0,
  avg_session_duration INTEGER DEFAULT 0,
  bounce_rate NUMERIC(5,2) DEFAULT 0,
  top_pages JSONB DEFAULT '[]',
  traffic_sources JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, period_date)
);

CREATE TABLE IF NOT EXISTS public.brandaro_optimization_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.brandaro_clients(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.brandaro_projects(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL,
  page_target TEXT,
  current_value TEXT,
  suggested_value TEXT,
  ai_reasoning TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  performance_before JSONB,
  performance_after JSONB,
  approved_by UUID,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brandaro_seo_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.brandaro_clients(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.brandaro_projects(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL,
  title TEXT NOT NULL,
  target_keyword TEXT,
  target_location TEXT,
  content TEXT,
  status TEXT DEFAULT 'pending',
  published_url TEXT,
  performance_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.brandaro_site_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.brandaro_projects(id) ON DELETE CASCADE NOT NULL,
  version_number INTEGER DEFAULT 1,
  page_path TEXT NOT NULL,
  content_snapshot JSONB,
  html_snapshot TEXT,
  is_active BOOLEAN DEFAULT true,
  performance_metrics JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brandaro_client_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.brandaro_clients(id) ON DELETE CASCADE NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT DEFAULT 'warning',
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on new tables only
DO $$ BEGIN
  ALTER TABLE public.brandaro_lead_events ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.brandaro_client_metrics ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.brandaro_optimization_tasks ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.brandaro_seo_tasks ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.brandaro_site_versions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.brandaro_client_alerts ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Policies (drop if exists pattern)
DROP POLICY IF EXISTS "Authenticated users manage lead events" ON public.brandaro_lead_events;
CREATE POLICY "Authenticated users manage lead events" ON public.brandaro_lead_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage client metrics" ON public.brandaro_client_metrics;
CREATE POLICY "Authenticated users manage client metrics" ON public.brandaro_client_metrics FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage optimization tasks" ON public.brandaro_optimization_tasks;
CREATE POLICY "Authenticated users manage optimization tasks" ON public.brandaro_optimization_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage seo tasks" ON public.brandaro_seo_tasks;
CREATE POLICY "Authenticated users manage seo tasks" ON public.brandaro_seo_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage site versions" ON public.brandaro_site_versions;
CREATE POLICY "Authenticated users manage site versions" ON public.brandaro_site_versions FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage client alerts" ON public.brandaro_client_alerts;
CREATE POLICY "Authenticated users manage client alerts" ON public.brandaro_client_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can insert lead events" ON public.brandaro_lead_events;
CREATE POLICY "Anon can insert lead events" ON public.brandaro_lead_events FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can insert call logs" ON public.brandaro_call_logs;
CREATE POLICY "Anon can insert call logs" ON public.brandaro_call_logs FOR INSERT TO anon WITH CHECK (true);

-- Add columns to projects
ALTER TABLE public.brandaro_projects ADD COLUMN IF NOT EXISTS tracking_script_installed BOOLEAN DEFAULT false;
ALTER TABLE public.brandaro_projects ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE public.brandaro_projects ADD COLUMN IF NOT EXISTS seo_status TEXT DEFAULT 'pending';
ALTER TABLE public.brandaro_projects ADD COLUMN IF NOT EXISTS monthly_report_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.brandaro_projects ADD COLUMN IF NOT EXISTS last_report_sent_at TIMESTAMPTZ;

ALTER TABLE public.brandaro_subscriptions ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'growth';
ALTER TABLE public.brandaro_subscriptions ADD COLUMN IF NOT EXISTS includes_seo BOOLEAN DEFAULT false;
ALTER TABLE public.brandaro_subscriptions ADD COLUMN IF NOT EXISTS includes_ads BOOLEAN DEFAULT false;
