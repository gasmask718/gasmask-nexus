-- Store Revenue Scores - daily snapshot per store
CREATE TABLE IF NOT EXISTS public.store_revenue_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.store_master(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id),
  vertical_id UUID REFERENCES public.brand_verticals(id),

  snapshot_date DATE NOT NULL,

  heat_score NUMERIC(5,2),
  churn_risk NUMERIC(5,2),
  order_prob_7d NUMERIC(5,2),
  avg_order_value NUMERIC(12,2),
  revenue_30d NUMERIC(12,2),
  revenue_90d NUMERIC(12,2),
  order_count_30d INTEGER,
  order_count_90d INTEGER,

  last_order_at TIMESTAMPTZ,
  predicted_next_order_at TIMESTAMPTZ,
  restock_window_start TIMESTAMPTZ,
  restock_window_end TIMESTAMPTZ,

  communication_score NUMERIC(5,2),
  sentiment_score NUMERIC(5,2),
  deal_activity_score NUMERIC(5,2),
  follow_up_intensity NUMERIC(5,2),

  tags TEXT[],

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_revenue_scores_store_date
  ON public.store_revenue_scores(store_id, snapshot_date);

CREATE INDEX IF NOT EXISTS idx_store_revenue_scores_business_date
  ON public.store_revenue_scores(business_id, snapshot_date);

-- Store Revenue Recommendations - AI suggested actions
CREATE TABLE IF NOT EXISTS public.store_revenue_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.store_master(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id),
  vertical_id UUID REFERENCES public.brand_verticals(id),

  score_snapshot_id UUID REFERENCES public.store_revenue_scores(id) ON DELETE CASCADE,

  priority INTEGER DEFAULT 3,
  reason TEXT,

  recommended_action TEXT,
  recommended_brand TEXT,
  recommended_offer JSONB,

  notes TEXT,
  synced_to_followup BOOLEAN DEFAULT false,
  followup_id UUID,

  created_from_engine TEXT DEFAULT 'revenue_engine_v1',

  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_store_revenue_recommendations_store
  ON public.store_revenue_recommendations(store_id);

CREATE INDEX IF NOT EXISTS idx_store_revenue_recommendations_priority
  ON public.store_revenue_recommendations(priority, created_at DESC);

-- Enable RLS
ALTER TABLE public.store_revenue_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_revenue_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for store_revenue_scores
CREATE POLICY "Users can view store revenue scores"
  ON public.store_revenue_scores FOR SELECT
  USING (true);

CREATE POLICY "System can insert store revenue scores"
  ON public.store_revenue_scores FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update store revenue scores"
  ON public.store_revenue_scores FOR UPDATE
  USING (true);

-- RLS Policies for store_revenue_recommendations
CREATE POLICY "Users can view store revenue recommendations"
  ON public.store_revenue_recommendations FOR SELECT
  USING (true);

CREATE POLICY "System can insert store revenue recommendations"
  ON public.store_revenue_recommendations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update store revenue recommendations"
  ON public.store_revenue_recommendations FOR UPDATE
  USING (true);