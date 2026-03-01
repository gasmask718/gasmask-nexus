
-- Audience segments table for Dynamic Audience Builder
CREATE TABLE public.audience_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  filter_config JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_dynamic BOOLEAN NOT NULL DEFAULT true,
  cached_count INTEGER DEFAULT 0,
  cached_at TIMESTAMPTZ,
  engagement_rate NUMERIC(5,2) DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.audience_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audience segments for their business"
  ON public.audience_segments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage audience segments"
  ON public.audience_segments FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Insert default "Previous Customers" segment
INSERT INTO public.audience_segments (name, description, filter_config, is_default, is_dynamic)
VALUES (
  'Previous Customers',
  'Stores that have placed at least one paid, completed, or fulfilled order',
  '{"source": "store_master", "join": "marketplace_orders", "conditions": [{"field": "payment_status", "operator": "in", "value": ["paid", "completed", "fulfilled"]}], "fields": ["store_id", "store_name", "phone", "last_order_date", "total_orders"]}',
  true,
  true
);
