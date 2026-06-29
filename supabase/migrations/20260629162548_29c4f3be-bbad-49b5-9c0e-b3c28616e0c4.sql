
-- ============================================================
-- SECTION 1: dd_config feature flags
-- ============================================================
ALTER TABLE public.dd_config
  ADD COLUMN IF NOT EXISTS grabba_bridge_enabled bool DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_catalog_engine_enabled bool DEFAULT true,
  ADD COLUMN IF NOT EXISTS store_portal_enabled bool DEFAULT true,
  ADD COLUMN IF NOT EXISTS split_pay_enabled bool DEFAULT true,
  ADD COLUMN IF NOT EXISTS rolling_reserve_enabled bool DEFAULT true,
  ADD COLUMN IF NOT EXISTS inventory_sync_enabled bool DEFAULT true,
  ADD COLUMN IF NOT EXISTS low_stock_threshold int DEFAULT 5,
  ADD COLUMN IF NOT EXISTS auto_reorder_enabled bool DEFAULT false;

UPDATE public.dd_config
SET
  grabba_bridge_enabled = COALESCE(grabba_bridge_enabled, true),
  ai_catalog_engine_enabled = COALESCE(ai_catalog_engine_enabled, true),
  store_portal_enabled = COALESCE(store_portal_enabled, true),
  split_pay_enabled = COALESCE(split_pay_enabled, true),
  rolling_reserve_enabled = COALESCE(rolling_reserve_enabled, true),
  inventory_sync_enabled = COALESCE(inventory_sync_enabled, true),
  low_stock_threshold = COALESCE(low_stock_threshold, 5),
  auto_reorder_enabled = COALESCE(auto_reorder_enabled, false);

-- ============================================================
-- SECTION 2: suppliers deprecation + data migration
-- ============================================================
INSERT INTO public.wholesalers (name, email, status)
SELECT s.name, s.contact_email, COALESCE(s.status, 'active')
FROM public.suppliers s
WHERE NOT EXISTS (
  SELECT 1 FROM public.wholesalers w WHERE w.name = s.name
);

COMMENT ON TABLE public.suppliers IS
  'DEPRECATED for Dynasty Direct — use wholesalers table for DD. Procurement / OS Warehouse still reads this table for purchase-order workflows; do not add new DD data here.';

-- ============================================================
-- SECTION 3: store_accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.store_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  business_name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  store_type text DEFAULT 'retail'
    CHECK (store_type IN ('retail','restaurant','hotel','event_venue','online','other')),
  pricing_tier text DEFAULT 'store'
    CHECK (pricing_tier IN ('store','wholesale','vip')),
  credit_limit numeric DEFAULT 0,
  payment_terms text DEFAULT 'net30'
    CHECK (payment_terms IN ('prepay','net15','net30','net60')),
  ambassador_id uuid,
  total_orders int DEFAULT 0,
  total_spent numeric DEFAULT 0,
  avg_order_value numeric DEFAULT 0,
  last_order_at timestamptz,
  status text DEFAULT 'active'
    CHECK (status IN ('pending','active','suspended','closed')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_accounts TO authenticated;
GRANT ALL ON public.store_accounts TO service_role;

ALTER TABLE public.store_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access store_accounts" ON public.store_accounts;
CREATE POLICY "Admin full access store_accounts"
  ON public.store_accounts
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_store_accounts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS store_accounts_set_updated_at ON public.store_accounts;
CREATE TRIGGER store_accounts_set_updated_at
  BEFORE UPDATE ON public.store_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_store_accounts_updated_at();

-- ============================================================
-- SECTION 5: inventory columns + decrement/restock RPCs
-- ============================================================
ALTER TABLE public.products_all
  ADD COLUMN IF NOT EXISTS low_stock_threshold int DEFAULT 5,
  ADD COLUMN IF NOT EXISTS track_inventory boolean DEFAULT true;

CREATE OR REPLACE FUNCTION public.dd_decrement_inventory(
  p_product_id uuid,
  p_quantity int,
  p_order_id uuid,
  p_reason text DEFAULT 'sale'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products_all
  SET inventory_qty = inventory_qty - p_quantity
  WHERE id = p_product_id
    AND COALESCE(track_inventory, true) = true
    AND inventory_qty >= p_quantity;

  IF NOT FOUND THEN
    -- Either tracking off, no row, or insufficient stock. If product exists & tracked, raise.
    IF EXISTS (
      SELECT 1 FROM public.products_all
      WHERE id = p_product_id AND COALESCE(track_inventory, true) = true
    ) THEN
      RAISE EXCEPTION 'Insufficient inventory for product %', p_product_id;
    END IF;
  END IF;

  INSERT INTO public.inventory_movements (
    product_id, movement_type, quantity, notes, reference_type, reference_id, order_id
  ) VALUES (
    p_product_id, p_reason, -p_quantity, p_reason, 'dd_order', p_order_id::text, p_order_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.dd_restock_inventory(
  p_product_id uuid,
  p_quantity int,
  p_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products_all
  SET inventory_qty = COALESCE(inventory_qty, 0) + p_quantity
  WHERE id = p_product_id;

  INSERT INTO public.inventory_movements (
    product_id, movement_type, quantity, notes, reference_type, reference_id, order_id
  ) VALUES (
    p_product_id, 'restock_refund', p_quantity, 'restock_refund', 'dd_order', p_order_id::text, p_order_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dd_decrement_inventory(uuid,int,uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dd_restock_inventory(uuid,int,uuid) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.dd_low_stock_products AS
SELECT
  p.id,
  p.product_name AS name,
  p.inventory_qty,
  p.low_stock_threshold,
  (p.inventory_qty <= p.low_stock_threshold) AS is_low,
  p.wholesaler_id,
  p.status
FROM public.products_all p
WHERE COALESCE(p.track_inventory, true) = true
  AND p.status = 'active'
ORDER BY p.inventory_qty ASC;

GRANT SELECT ON public.dd_low_stock_products TO authenticated, service_role;

-- ============================================================
-- SECTION 6: dd_grabba_sync (DD→GasMask sync log)
--   Note: dd_wholesaler_grabba_orders is a read-only VIEW owned by
--   GasMask; we do NOT touch it. We create a new sync-state table.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dd_grabba_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace_order_id uuid NOT NULL,
  wholesaler_id uuid,
  items jsonb DEFAULT '[]'::jsonb,
  customer_name text,
  delivery_address jsonb,
  status text DEFAULT 'pending'
    CHECK (status IN ('pending','synced','failed','skipped')),
  attempt_count int DEFAULT 0,
  last_error text,
  synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dd_grabba_sync_order_idx
  ON public.dd_grabba_sync(marketplace_order_id);
CREATE INDEX IF NOT EXISTS dd_grabba_sync_status_idx
  ON public.dd_grabba_sync(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_grabba_sync TO authenticated;
GRANT ALL ON public.dd_grabba_sync TO service_role;

ALTER TABLE public.dd_grabba_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access dd_grabba_sync" ON public.dd_grabba_sync;
CREATE POLICY "Admin full access dd_grabba_sync"
  ON public.dd_grabba_sync
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_dd_grabba_sync_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS dd_grabba_sync_set_updated_at ON public.dd_grabba_sync;
CREATE TRIGGER dd_grabba_sync_set_updated_at
  BEFORE UPDATE ON public.dd_grabba_sync
  FOR EACH ROW EXECUTE FUNCTION public.update_dd_grabba_sync_updated_at();
