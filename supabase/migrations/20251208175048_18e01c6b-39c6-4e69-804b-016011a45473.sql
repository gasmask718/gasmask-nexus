-- Product Revenue Metrics - daily snapshot per product
CREATE TABLE IF NOT EXISTS public.product_revenue_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  business_id UUID REFERENCES public.businesses(id),
  vertical_id UUID REFERENCES public.brand_verticals(id),

  snapshot_date DATE NOT NULL,

  total_revenue_30d NUMERIC(12,2),
  total_revenue_90d NUMERIC(12,2),
  units_sold_30d INTEGER,
  units_sold_90d INTEGER,

  avg_order_quantity NUMERIC(10,2),
  unique_stores_30d INTEGER,
  unique_stores_90d INTEGER,

  trend_30d NUMERIC(6,2),
  trend_90d NUMERIC(6,2),

  hero_score NUMERIC(5,2),
  ghost_score NUMERIC(5,2),

  tags TEXT[],

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prm_product_date
  ON public.product_revenue_metrics(product_id, snapshot_date);

CREATE INDEX IF NOT EXISTS idx_prm_business_date
  ON public.product_revenue_metrics(business_id, snapshot_date);

-- Store × Product Predictions
CREATE TABLE IF NOT EXISTS public.store_product_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.store_master(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  business_id UUID REFERENCES public.businesses(id),
  vertical_id UUID REFERENCES public.brand_verticals(id),

  snapshot_date DATE NOT NULL,

  buy_prob_7d NUMERIC(5,2),
  buy_prob_30d NUMERIC(5,2),

  last_order_at TIMESTAMPTZ,
  expected_quantity NUMERIC(10,2),

  is_primary_sku BOOLEAN DEFAULT false,
  is_experiment_candidate BOOLEAN DEFAULT false,

  tags TEXT[],

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spp_store_date
  ON public.store_product_predictions(store_id, snapshot_date);

CREATE INDEX IF NOT EXISTS idx_spp_product_date
  ON public.store_product_predictions(product_id, snapshot_date);

-- Product Deal Recommendations
CREATE TABLE IF NOT EXISTS public.product_deal_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id),
  vertical_id UUID REFERENCES public.brand_verticals(id),
  product_id UUID,
  related_product_ids UUID[] DEFAULT '{}',

  deal_type TEXT,
  target_segment TEXT,

  suggested_discount_pct NUMERIC(5,2),
  suggested_bundle_price NUMERIC(12,2),
  suggested_min_qty INTEGER,
  notes TEXT,

  synced_to_campaign BOOLEAN DEFAULT false,
  campaign_id UUID,

  created_by_engine TEXT DEFAULT 'revenue_engine_v2',
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pdr_business
  ON public.product_deal_recommendations(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pdr_vertical
  ON public.product_deal_recommendations(vertical_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.product_revenue_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_product_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_deal_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view product revenue metrics"
  ON public.product_revenue_metrics FOR SELECT USING (true);

CREATE POLICY "System can manage product revenue metrics"
  ON public.product_revenue_metrics FOR ALL USING (true);

CREATE POLICY "Users can view store product predictions"
  ON public.store_product_predictions FOR SELECT USING (true);

CREATE POLICY "System can manage store product predictions"
  ON public.store_product_predictions FOR ALL USING (true);

CREATE POLICY "Users can view product deal recommendations"
  ON public.product_deal_recommendations FOR SELECT USING (true);

CREATE POLICY "System can manage product deal recommendations"
  ON public.product_deal_recommendations FOR ALL USING (true);