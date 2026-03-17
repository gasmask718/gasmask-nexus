
-- SEO/Google Domination tables for Brandaro

CREATE TABLE IF NOT EXISTS public.brandaro_seo_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type TEXT NOT NULL DEFAULT 'city_service',
  city TEXT,
  state TEXT,
  industry TEXT,
  slug TEXT UNIQUE,
  keyword_primary TEXT,
  keyword_secondary TEXT[],
  page_title TEXT,
  meta_description TEXT,
  h1 TEXT,
  html_content TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  indexed BOOLEAN DEFAULT false,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brandaro_local_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_keyword TEXT NOT NULL,
  city TEXT,
  state TEXT,
  domain TEXT,
  avg_position NUMERIC(5,1) DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr NUMERIC(5,2) DEFAULT 0,
  rank_score INTEGER DEFAULT 0,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brandaro_seo_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_name TEXT NOT NULL,
  industry TEXT,
  city TEXT,
  pillar_keyword TEXT,
  support_keywords TEXT[],
  page_count INTEGER DEFAULT 0,
  traffic_estimate INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planning',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brandaro_client_seo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.brandaro_leads_master(id) ON DELETE SET NULL,
  client_name TEXT,
  domain TEXT,
  city TEXT,
  state TEXT,
  target_keywords TEXT[],
  pages_created INTEGER DEFAULT 0,
  current_traffic INTEGER DEFAULT 0,
  estimated_leads INTEGER DEFAULT 0,
  ranking_growth_pct NUMERIC(5,1) DEFAULT 0,
  service_fee NUMERIC(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.brandaro_seo_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_local_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_seo_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_client_seo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth manage seo_pages" ON public.brandaro_seo_pages;
CREATE POLICY "Auth manage seo_pages" ON public.brandaro_seo_pages FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth manage local_rankings" ON public.brandaro_local_rankings;
CREATE POLICY "Auth manage local_rankings" ON public.brandaro_local_rankings FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth manage seo_clusters" ON public.brandaro_seo_clusters;
CREATE POLICY "Auth manage seo_clusters" ON public.brandaro_seo_clusters FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth manage client_seo" ON public.brandaro_client_seo;
CREATE POLICY "Auth manage client_seo" ON public.brandaro_client_seo FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_seo_pages_status ON public.brandaro_seo_pages(status);
CREATE INDEX IF NOT EXISTS idx_seo_pages_city ON public.brandaro_seo_pages(city);
CREATE INDEX IF NOT EXISTS idx_local_rankings_keyword ON public.brandaro_local_rankings(target_keyword);
CREATE INDEX IF NOT EXISTS idx_seo_clusters_status ON public.brandaro_seo_clusters(status);
CREATE INDEX IF NOT EXISTS idx_client_seo_status ON public.brandaro_client_seo(status);
