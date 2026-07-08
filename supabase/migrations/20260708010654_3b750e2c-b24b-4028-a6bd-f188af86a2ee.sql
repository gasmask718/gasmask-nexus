
ALTER TABLE public.products_all
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS supplier_id uuid,
  ADD COLUMN IF NOT EXISTS supplier_cost numeric,
  ADD COLUMN IF NOT EXISTS store_price_a numeric,
  ADD COLUMN IF NOT EXISTS dtc_price_b numeric,
  ADD COLUMN IF NOT EXISTS map_price numeric,
  ADD COLUMN IF NOT EXISTS min_store_margin_pct numeric DEFAULT 25,
  ADD COLUMN IF NOT EXISTS target_store_margin_pct numeric DEFAULT 40,
  ADD COLUMN IF NOT EXISTS min_dtc_margin_pct numeric DEFAULT 50,
  ADD COLUMN IF NOT EXISTS target_dtc_margin_pct numeric DEFAULT 65,
  ADD COLUMN IF NOT EXISTS market_avg_retail numeric,
  ADD COLUMN IF NOT EXISTS market_low_retail numeric,
  ADD COLUMN IF NOT EXISTS market_high_retail numeric,
  ADD COLUMN IF NOT EXISTS market_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS pricing_strategy text DEFAULT 'match_market',
  ADD COLUMN IF NOT EXISTS is_age_restricted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_pact_act boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS geo_blocked_states text[],
  ADD COLUMN IF NOT EXISTS ai_description text,
  ADD COLUMN IF NOT EXISTS ai_description_short text,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_keywords text[],
  ADD COLUMN IF NOT EXISTS description_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS image_enhanced_at timestamptz;

ALTER TABLE public.products_all
  ADD COLUMN IF NOT EXISTS store_margin_pct numeric GENERATED ALWAYS AS (
    CASE WHEN supplier_cost > 0 AND store_price_a > 0
    THEN ROUND((store_price_a - supplier_cost) / store_price_a * 100, 2) ELSE NULL END
  ) STORED,
  ADD COLUMN IF NOT EXISTS dtc_margin_pct numeric GENERATED ALWAYS AS (
    CASE WHEN supplier_cost > 0 AND dtc_price_b > 0
    THEN ROUND((dtc_price_b - supplier_cost) / dtc_price_b * 100, 2) ELSE NULL END
  ) STORED;

ALTER TABLE public.products_all ALTER COLUMN units_per_case SET DEFAULT 1;
ALTER TABLE public.products_all ALTER COLUMN min_order_qty SET DEFAULT 1;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_all_pricing_strategy_check') THEN
    ALTER TABLE public.products_all
      ADD CONSTRAINT products_all_pricing_strategy_check
      CHECK (pricing_strategy IN ('match_market','beat_market','premium','map_enforced'));
  END IF;
END $$;
