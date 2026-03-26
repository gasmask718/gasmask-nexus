
-- =============================================
-- PRODUCT + SUPPLIER ENGINE COMPLETION
-- =============================================

-- 1) Extend ut_suppliers with missing fields
ALTER TABLE ut_suppliers
  ADD COLUMN IF NOT EXISTS supplier_type text DEFAULT 'dropship',
  ADD COLUMN IF NOT EXISTS api_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS platform_url text,
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS avg_lead_time_days integer,
  ADD COLUMN IF NOT EXISTS return_policy text;

-- 2) Extend ut_products with missing fields
ALTER TABLE ut_products
  ADD COLUMN IF NOT EXISTS cost_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS is_trending boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_listed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS inventory_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS external_product_id text,
  ADD COLUMN IF NOT EXISTS supplier_product_url text,
  ADD COLUMN IF NOT EXISTS auto_order_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recommendation_level text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS vendor_owner_id uuid,
  ADD COLUMN IF NOT EXISTS rental_price_estimate numeric(10,2),
  ADD COLUMN IF NOT EXISTS events_to_break_even integer,
  ADD COLUMN IF NOT EXISTS monthly_income_estimate numeric(10,2),
  ADD COLUMN IF NOT EXISTS gift_relevance_score numeric(3,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS entrepreneur_relevance_score numeric(3,1) DEFAULT 0;

-- 3) Add item_role to ut_package_items
ALTER TABLE ut_package_items
  ADD COLUMN IF NOT EXISTS item_role text DEFAULT 'core';

-- 4) Product Intelligence RPC
CREATE OR REPLACE FUNCTION ut_score_products()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  scored integer := 0;
  r record;
  new_score numeric;
  rec_level text;
BEGIN
  FOR r IN SELECT * FROM ut_products WHERE is_active = true
  LOOP
    -- Weighted scoring: margin(30) + shipping(20) + trend(15) + visual(15) + event(10) + conversion(10)
    new_score := 0;

    -- Margin score (0-30): >60% = 30, >40% = 22, >20% = 15, else 5
    IF r.margin_pct IS NOT NULL THEN
      IF r.margin_pct > 60 THEN new_score := new_score + 30;
      ELSIF r.margin_pct > 40 THEN new_score := new_score + 22;
      ELSIF r.margin_pct > 20 THEN new_score := new_score + 15;
      ELSE new_score := new_score + 5;
      END IF;
    END IF;

    -- Shipping speed (0-20): <3d = 20, <7d = 14, <14d = 8, else 3
    IF r.shipping_speed_days IS NOT NULL THEN
      IF r.shipping_speed_days <= 3 THEN new_score := new_score + 20;
      ELSIF r.shipping_speed_days <= 7 THEN new_score := new_score + 14;
      ELSIF r.shipping_speed_days <= 14 THEN new_score := new_score + 8;
      ELSE new_score := new_score + 3;
      END IF;
    END IF;

    -- Direct scores (already 0-10 scale, weighted)
    new_score := new_score + COALESCE(r.trend_score, 0) * 1.5;
    new_score := new_score + COALESCE(r.visual_appeal_score, 0) * 1.5;
    new_score := new_score + COALESCE(r.event_relevance_score, 0);
    new_score := new_score + COALESCE(r.conversion_score, 0);

    -- Clamp
    IF new_score > 100 THEN new_score := 100; END IF;
    IF new_score < 0 THEN new_score := 0; END IF;

    -- Recommendation level
    IF new_score >= 75 THEN rec_level := 'high';
    ELSIF new_score >= 45 THEN rec_level := 'medium';
    ELSE rec_level := 'low';
    END IF;

    -- ROI for business assets
    IF r.product_type = 'business_asset' AND r.sell_price IS NOT NULL AND r.sell_price > 0 AND r.rental_price_estimate IS NOT NULL AND r.rental_price_estimate > 0 THEN
      UPDATE ut_products SET
        events_to_break_even = CEIL(r.sell_price / r.rental_price_estimate),
        monthly_income_estimate = r.rental_price_estimate * 4
      WHERE id = r.id;
    END IF;

    UPDATE ut_products SET
      overall_score = new_score,
      recommendation_level = rec_level,
      is_trending = (r.trend_score >= 7),
      updated_at = now()
    WHERE id = r.id;

    scored := scored + 1;
  END LOOP;

  RETURN scored;
END;
$$;

-- 5) Product summary view
CREATE OR REPLACE VIEW v_ut_product_summary AS
SELECT
  p.id,
  p.name,
  p.product_type::text,
  p.category,
  p.subcategory,
  p.cost_price,
  p.landed_cost,
  p.sell_price,
  p.margin_pct,
  p.shipping_speed_days,
  p.fulfillment_model::text,
  p.overall_score,
  p.recommendation_level,
  p.is_trending,
  p.is_featured,
  p.is_listed,
  p.is_active,
  p.rental_price_estimate,
  p.events_to_break_even,
  p.monthly_income_estimate,
  p.trend_score,
  p.conversion_score,
  p.visual_appeal_score,
  p.event_relevance_score,
  p.gift_relevance_score,
  p.entrepreneur_relevance_score,
  s.name as supplier_name,
  s.supplier_type,
  s.reliability_score as supplier_reliability,
  s.source_platform as supplier_platform,
  p.created_at,
  p.updated_at
FROM ut_products p
LEFT JOIN ut_suppliers s ON p.supplier_id = s.id;

-- 6) Supplier scorecard view
CREATE OR REPLACE VIEW v_ut_supplier_scorecard AS
SELECT
  s.id,
  s.name,
  s.supplier_type,
  s.source_platform,
  s.fulfillment_model::text,
  s.shipping_speed_days,
  s.quality_rating,
  s.reliability_score,
  s.min_order_qty,
  s.api_enabled,
  s.is_active,
  COUNT(p.id) as product_count,
  COUNT(CASE WHEN p.product_type = 'gift' THEN 1 END) as gift_count,
  COUNT(CASE WHEN p.product_type = 'business_asset' THEN 1 END) as asset_count,
  AVG(p.margin_pct) as avg_margin,
  AVG(p.overall_score) as avg_product_score,
  COUNT(CASE WHEN p.is_trending THEN 1 END) as trending_count
FROM ut_suppliers s
LEFT JOIN ut_products p ON p.supplier_id = s.id AND p.is_active = true
GROUP BY s.id;
