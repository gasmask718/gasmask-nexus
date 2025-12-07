-- Brand CRM V3: Store Scores, Tasks, and AI Insights

-- Store Scores table for priority scoring
CREATE TABLE public.store_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 50 CHECK (score >= 0 AND score <= 100),
  priority_label TEXT NOT NULL DEFAULT 'Medium' CHECK (priority_label IN ('High', 'Medium', 'Low')),
  reason_summary TEXT,
  last_calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Brand Tasks table for follow-ups and to-dos
CREATE TABLE public.brand_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID,
  contact_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Done')),
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by TEXT NOT NULL DEFAULT 'User' CHECK (created_by IN ('AI', 'User'))
);

-- Brand Insights Cache for AI summaries
CREATE TABLE public.brand_insights_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  ai_summary TEXT,
  ai_top_actions TEXT,
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(business_id)
);

-- Enable RLS
ALTER TABLE public.store_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_insights_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for authenticated users
CREATE POLICY "Authenticated users can manage store scores"
ON public.store_scores FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage brand tasks"
ON public.brand_tasks FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage brand insights"
ON public.brand_insights_cache FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Indexes for performance
CREATE INDEX idx_store_scores_business ON public.store_scores(business_id);
CREATE INDEX idx_store_scores_store ON public.store_scores(store_id);
CREATE INDEX idx_brand_tasks_business ON public.brand_tasks(business_id);
CREATE INDEX idx_brand_tasks_status ON public.brand_tasks(status);
CREATE INDEX idx_brand_insights_business ON public.brand_insights_cache(business_id);