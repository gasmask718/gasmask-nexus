
CREATE TABLE IF NOT EXISTS public.dd_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text UNIQUE NOT NULL,
  wholesaler_id uuid NOT NULL REFERENCES public.wholesalers(id) ON DELETE RESTRICT,
  marketplace_order_id uuid REFERENCES public.marketplace_orders(id) ON DELETE SET NULL,
  grabba_sync_id uuid,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','acknowledged','in_production','shipped','delivered','cancelled')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  shipping_cost numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  payment_terms text NOT NULL DEFAULT 'net30',
  expected_ship_date date,
  expected_delivery_date date,
  actual_ship_date date,
  tracking_number text,
  carrier text,
  notes text,
  sent_at timestamptz,
  acknowledged_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_purchase_orders TO authenticated;
GRANT ALL ON public.dd_purchase_orders TO service_role;

ALTER TABLE public.dd_purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access dd_purchase_orders"
  ON public.dd_purchase_orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_dd_po_wholesaler ON public.dd_purchase_orders(wholesaler_id);
CREATE INDEX IF NOT EXISTS idx_dd_po_order ON public.dd_purchase_orders(marketplace_order_id);
CREATE INDEX IF NOT EXISTS idx_dd_po_status ON public.dd_purchase_orders(status);

CREATE SEQUENCE IF NOT EXISTS public.dd_po_number_seq START 1;
GRANT USAGE, SELECT ON SEQUENCE public.dd_po_number_seq TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.dd_generate_po_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'PO-' || to_char(now(), 'YYYY') || '-' ||
    LPAD(nextval('public.dd_po_number_seq')::text, 4, '0');
END;
$$;

-- Create PO from a marketplace order for one wholesaler.
-- Uses products_all.wholesale_price as the supplier unit cost.
CREATE OR REPLACE FUNCTION public.dd_create_purchase_order(
  p_wholesaler_id uuid,
  p_order_id uuid,
  p_grabba_sync_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po_id uuid;
  v_po_number text;
  v_items jsonb;
  v_subtotal numeric;
BEGIN
  v_po_number := public.dd_generate_po_number();

  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'product_id', pa.id,
      'product_name', pa.product_name,
      'sku', '',
      'quantity', moi.qty,
      'unit_cost', COALESCE(pa.wholesale_price, moi.price_each, 0),
      'line_total', moi.qty * COALESCE(pa.wholesale_price, moi.price_each, 0)
    )), '[]'::jsonb),
    COALESCE(SUM(moi.qty * COALESCE(pa.wholesale_price, moi.price_each, 0)), 0)
  INTO v_items, v_subtotal
  FROM public.marketplace_order_items moi
  JOIN public.products_all pa ON pa.id = moi.product_id
  WHERE moi.order_id = p_order_id
    AND (moi.wholesaler_id = p_wholesaler_id OR pa.wholesaler_id = p_wholesaler_id);

  INSERT INTO public.dd_purchase_orders (
    po_number, wholesaler_id, marketplace_order_id, grabba_sync_id,
    items, subtotal, total, status, payment_terms, expected_ship_date, created_by
  ) VALUES (
    v_po_number, p_wholesaler_id, p_order_id, p_grabba_sync_id,
    v_items, v_subtotal, v_subtotal,
    'draft', 'net30', (now()::date + 2), auth.uid()
  )
  RETURNING id INTO v_po_id;

  RETURN v_po_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dd_generate_po_number() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dd_create_purchase_order(uuid, uuid, uuid) TO authenticated, service_role;
