
-- ═══════════════════════════════════════════════════════════════
-- DYNASTY DIRECT SPRINT 1 — fuel the engine
-- ═══════════════════════════════════════════════════════════════

-- 1. WHOLESALER UNIFICATION ────────────────────────────────────
ALTER TABLE public.wholesaler_profiles
  ADD COLUMN IF NOT EXISTS wholesaler_id uuid REFERENCES public.wholesalers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS warehouse_street text,
  ADD COLUMN IF NOT EXISTS warehouse_city text,
  ADD COLUMN IF NOT EXISTS warehouse_state text,
  ADD COLUMN IF NOT EXISTS warehouse_zip text,
  ADD COLUMN IF NOT EXISTS warehouse_country text DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS warehouse_lat numeric,
  ADD COLUMN IF NOT EXISTS warehouse_lng numeric;

CREATE INDEX IF NOT EXISTS idx_wholesaler_profiles_wholesaler_id ON public.wholesaler_profiles(wholesaler_id);

ALTER TABLE public.wholesalers
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS geocode_status text DEFAULT 'pending', -- pending | geocoded | failed | needs_review
  ADD COLUMN IF NOT EXISTS geocode_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS geocode_notes text;

CREATE INDEX IF NOT EXISTS idx_wholesalers_geocode_status ON public.wholesalers(geocode_status);

COMMENT ON COLUMN public.wholesaler_profiles.wholesaler_id IS
  'FK to wholesalers (CRM master record). RULE: wholesalers=master CRM identity (territory, tier, contract); wholesaler_profiles=auth+portal access. One CRM row may have zero or one profile.';

-- 2. MARKETPLACE_INVENTORY — fix FKs so it points to live tables
ALTER TABLE public.marketplace_inventory DROP CONSTRAINT IF EXISTS marketplace_inventory_product_id_fkey;
ALTER TABLE public.marketplace_inventory DROP CONSTRAINT IF EXISTS marketplace_inventory_wholesaler_id_fkey;

-- Point at products_all + wholesaler_profiles (parity with order pipeline)
ALTER TABLE public.marketplace_inventory
  ADD CONSTRAINT marketplace_inventory_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products_all(id) ON DELETE CASCADE,
  ADD CONSTRAINT marketplace_inventory_wholesaler_id_fkey
    FOREIGN KEY (wholesaler_id) REFERENCES public.wholesaler_profiles(id) ON DELETE CASCADE;

-- 3. MARKETPLACE_FULFILLMENTS — quote + carrier metadata
ALTER TABLE public.marketplace_fulfillments
  ADD COLUMN IF NOT EXISTS shipping_quote jsonb,                 -- { rate, currency, service, est_delivery_days, estimated:true|false }
  ADD COLUMN IF NOT EXISTS shipping_mode text DEFAULT 'sandbox', -- sandbox | live
  ADD COLUMN IF NOT EXISTS easypost_shipment_id text,
  ADD COLUMN IF NOT EXISTS easypost_rate_id text;

-- 4. ORDER DATA CONTRACT — public timeline view (the UI consumes this)
DROP VIEW IF EXISTS public.v_marketplace_order_timeline CASCADE;
CREATE VIEW public.v_marketplace_order_timeline AS
SELECT
  o.id                                                 AS order_id,
  o.user_id,
  o.payment_status,
  o.fulfillment_status,
  o.shipping_address,
  o.subtotal,
  o.shipping_cost,
  o.tax_amount,
  o.total,
  o.created_at                                         AS placed_at,
  o.notes,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'fulfillment_id', f.id,
        'wholesaler_id', f.wholesaler_id,
        'company_name',  wp.company_name,
        'status',        f.status,
        'tracking_number', f.tracking_number,
        'carrier',       f.carrier,
        'shipping_label_url', f.shipping_label_url,
        'shipping_quote', f.shipping_quote,
        'shipping_mode', f.shipping_mode,
        'items',         f.items_snapshot,
        'updated_at',    f.updated_at
      )
      ORDER BY f.created_at
    ) FILTER (WHERE f.id IS NOT NULL),
    '[]'::jsonb
  ) AS shipments,
  COUNT(f.id) AS shipment_count
FROM public.marketplace_orders o
LEFT JOIN public.marketplace_fulfillments f ON f.order_id = o.id
LEFT JOIN public.wholesaler_profiles wp ON wp.id = f.wholesaler_id
GROUP BY o.id;

GRANT SELECT ON public.v_marketplace_order_timeline TO authenticated, service_role;

-- 5. BACKFILL EXISTING FULFILLMENTS ─────────────────────────────
CREATE OR REPLACE FUNCTION public.backfill_marketplace_fulfillments()
RETURNS TABLE(orders_processed int, fulfillments_created int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orders int := 0;
  v_fulfillments int := 0;
BEGIN
  WITH per_supplier AS (
    SELECT
      oi.order_id,
      COALESCE(oi.wholesaler_id, o.wholesaler_id) AS wholesaler_id,
      jsonb_agg(jsonb_build_object(
        'product_id', oi.product_id,
        'qty', oi.qty,
        'price_each', oi.price_each
      )) AS items
    FROM public.marketplace_order_items oi
    JOIN public.marketplace_orders o ON o.id = oi.order_id
    WHERE COALESCE(oi.wholesaler_id, o.wholesaler_id) IS NOT NULL
    GROUP BY oi.order_id, COALESCE(oi.wholesaler_id, o.wholesaler_id)
  ),
  inserted AS (
    INSERT INTO public.marketplace_fulfillments (order_id, wholesaler_id, status, items_snapshot, shipping_mode)
    SELECT order_id, wholesaler_id, 'pending', items, 'sandbox'
    FROM per_supplier
    ON CONFLICT (order_id, wholesaler_id) DO NOTHING
    RETURNING order_id
  )
  SELECT
    (SELECT COUNT(DISTINCT order_id) FROM inserted),
    (SELECT COUNT(*) FROM inserted)
  INTO v_orders, v_fulfillments;

  -- Also handle orders that have NO items but DO have wholesaler_id at the order level (orphan case)
  WITH orphan_orders AS (
    SELECT o.id AS order_id, o.wholesaler_id
    FROM public.marketplace_orders o
    WHERE o.wholesaler_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.marketplace_order_items oi WHERE oi.order_id = o.id)
      AND NOT EXISTS (SELECT 1 FROM public.marketplace_fulfillments f WHERE f.order_id = o.id)
  ),
  inserted2 AS (
    INSERT INTO public.marketplace_fulfillments (order_id, wholesaler_id, status, items_snapshot, shipping_mode)
    SELECT order_id, wholesaler_id, 'pending', '[]'::jsonb, 'sandbox'
    FROM orphan_orders
    ON CONFLICT (order_id, wholesaler_id) DO NOTHING
    RETURNING order_id
  )
  SELECT v_orders + (SELECT COUNT(*) FROM inserted2),
         v_fulfillments + (SELECT COUNT(*) FROM inserted2)
  INTO v_orders, v_fulfillments;

  RETURN QUERY SELECT v_orders, v_fulfillments;
END;
$$;

GRANT EXECUTE ON FUNCTION public.backfill_marketplace_fulfillments() TO service_role;

-- 6. INVENTORY RESERVATION RPCS ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.reserve_marketplace_inventory(
  p_product_id uuid,
  p_wholesaler_id uuid,
  p_qty int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available int;
BEGIN
  -- Upsert a row if none exists (seeded from products_all.inventory_qty if available)
  INSERT INTO public.marketplace_inventory (product_id, wholesaler_id, quantity_available, reserved_quantity)
  SELECT p_product_id, p_wholesaler_id, COALESCE(pa.inventory_qty, 0), 0
  FROM public.products_all pa
  WHERE pa.id = p_product_id
  ON CONFLICT (product_id, wholesaler_id) DO NOTHING;

  SELECT quantity_available - reserved_quantity
    INTO v_available
  FROM public.marketplace_inventory
  WHERE product_id = p_product_id AND wholesaler_id = p_wholesaler_id
  FOR UPDATE;

  IF v_available IS NULL OR v_available < p_qty THEN
    RAISE EXCEPTION 'insufficient_stock: product %, supplier % (available %, requested %)',
      p_product_id, p_wholesaler_id, COALESCE(v_available, 0), p_qty
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.marketplace_inventory
  SET reserved_quantity = reserved_quantity + p_qty,
      updated_at = now()
  WHERE product_id = p_product_id AND wholesaler_id = p_wholesaler_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_marketplace_inventory(
  p_product_id uuid,
  p_wholesaler_id uuid,
  p_qty int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.marketplace_inventory
  SET reserved_quantity = GREATEST(0, reserved_quantity - p_qty),
      updated_at = now()
  WHERE product_id = p_product_id AND wholesaler_id = p_wholesaler_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_marketplace_inventory(
  p_product_id uuid,
  p_wholesaler_id uuid,
  p_qty int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.marketplace_inventory
  SET reserved_quantity   = GREATEST(0, reserved_quantity - p_qty),
      quantity_available  = GREATEST(0, quantity_available - p_qty),
      updated_at = now()
  WHERE product_id = p_product_id AND wholesaler_id = p_wholesaler_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_marketplace_inventory(uuid,uuid,int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_marketplace_inventory(uuid,uuid,int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_marketplace_inventory(uuid,uuid,int) TO service_role;

-- 7. CATALOG STOCK VIEW (sum across suppliers) ──────────────────
DROP VIEW IF EXISTS public.v_products_all_with_stock CASCADE;
CREATE VIEW public.v_products_all_with_stock AS
SELECT
  pa.*,
  COALESCE(SUM(GREATEST(mi.quantity_available - mi.reserved_quantity, 0)), pa.inventory_qty, 0) AS available_stock,
  COALESCE(SUM(mi.quantity_available), pa.inventory_qty, 0) AS total_stock,
  COUNT(mi.id) FILTER (WHERE mi.quantity_available > 0) AS supplier_count_with_stock
FROM public.products_all pa
LEFT JOIN public.marketplace_inventory mi ON mi.product_id = pa.id
GROUP BY pa.id;

GRANT SELECT ON public.v_products_all_with_stock TO anon, authenticated, service_role;
