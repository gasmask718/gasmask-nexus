
-- Trending products queue (AI scoring input/output)
CREATE TABLE public.trending_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  product_name TEXT NOT NULL,
  supplier TEXT,
  supplier_product_id TEXT,
  supplier_url TEXT,
  product_image TEXT,
  category TEXT,
  supplier_cost DECIMAL(10,2),
  suggested_sell_price DECIMAL(10,2),
  profit_margin DECIMAL(5,2),
  supplier_rating DECIMAL(3,2),
  total_orders INTEGER,
  shipping_days INTEGER,
  ship_from TEXT,
  ai_score INTEGER,
  margin_score INTEGER,
  demand_score INTEGER,
  competition_score INTEGER,
  niche_alignment_score INTEGER,
  shipping_score INTEGER,
  ai_reasoning TEXT,
  status TEXT DEFAULT 'pending',
  published_to_shopify BOOLEAN DEFAULT FALSE,
  shopify_product_id TEXT,
  source TEXT DEFAULT 'autods',
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Validation trigger for trending_products
CREATE OR REPLACE FUNCTION public.validate_trending_products()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ai_score IS NOT NULL AND (NEW.ai_score < 1 OR NEW.ai_score > 10) THEN
    RAISE EXCEPTION 'ai_score must be between 1 and 10';
  END IF;
  IF NEW.status IS NOT NULL AND NEW.status NOT IN ('pending', 'approved', 'rejected', 'published') THEN
    RAISE EXCEPTION 'Invalid status value';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_trending_products
  BEFORE INSERT OR UPDATE ON public.trending_products
  FOR EACH ROW EXECUTE FUNCTION public.validate_trending_products();

-- Orders tracking
CREATE TABLE public.dropship_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  shopify_order_id TEXT NOT NULL,
  shopify_order_number TEXT,
  customer_name TEXT,
  customer_email TEXT,
  customer_address JSONB,
  product_name TEXT,
  shopify_product_id TEXT,
  supplier_product_id TEXT,
  quantity INTEGER DEFAULT 1,
  sell_price DECIMAL(10,2),
  supplier_cost DECIMAL(10,2),
  profit DECIMAL(10,2),
  fulfillment_status TEXT DEFAULT 'pending',
  autods_order_id TEXT,
  tracking_number TEXT,
  carrier TEXT,
  sms_alert_sent BOOLEAN DEFAULT FALSE,
  notes TEXT
);

-- Validation trigger for dropship_orders
CREATE OR REPLACE FUNCTION public.validate_dropship_orders()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.fulfillment_status IS NOT NULL AND NEW.fulfillment_status NOT IN ('pending', 'ordered', 'shipped', 'delivered', 'refunded', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid fulfillment_status value';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_dropship_orders
  BEFORE INSERT OR UPDATE ON public.dropship_orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_dropship_orders();

-- Daily AI run log
CREATE TABLE public.ai_scoring_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  products_analyzed INTEGER DEFAULT 0,
  products_scored INTEGER DEFAULT 0,
  products_approved INTEGER DEFAULT 0,
  products_published INTEGER DEFAULT 0,
  run_status TEXT DEFAULT 'running',
  error_message TEXT,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Validation trigger for ai_scoring_runs
CREATE OR REPLACE FUNCTION public.validate_ai_scoring_runs()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.run_status IS NOT NULL AND NEW.run_status NOT IN ('running', 'completed', 'failed') THEN
    RAISE EXCEPTION 'Invalid run_status value';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_ai_scoring_runs
  BEFORE INSERT OR UPDATE ON public.ai_scoring_runs
  FOR EACH ROW EXECUTE FUNCTION public.validate_ai_scoring_runs();

-- Revenue summary
CREATE TABLE public.dropship_revenue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_orders INTEGER DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  total_profit DECIMAL(10,2) DEFAULT 0,
  best_selling_product TEXT,
  refund_count INTEGER DEFAULT 0,
  refund_amount DECIMAL(10,2) DEFAULT 0
);

-- Indexes for performance
CREATE INDEX idx_trending_products_score ON public.trending_products(ai_score DESC);
CREATE INDEX idx_trending_products_status ON public.trending_products(status);
CREATE INDEX idx_dropship_orders_status ON public.dropship_orders(fulfillment_status);
CREATE INDEX idx_dropship_revenue_date ON public.dropship_revenue(date DESC);

-- Enable RLS on all tables
ALTER TABLE public.trending_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropship_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_scoring_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropship_revenue ENABLE ROW LEVEL SECURITY;
