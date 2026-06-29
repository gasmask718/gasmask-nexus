-- Dynasty Direct: shipping vs local delivery
ALTER TABLE public.store_accounts
  ADD COLUMN IF NOT EXISTS preferred_delivery text DEFAULT 'shipping'
    CHECK (preferred_delivery IN ('shipping','local_delivery')),
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_city text,
  ADD COLUMN IF NOT EXISTS delivery_state text,
  ADD COLUMN IF NOT EXISTS delivery_zip text,
  ADD COLUMN IF NOT EXISTS delivery_notes text,
  ADD COLUMN IF NOT EXISTS delivery_window text;

ALTER TABLE public.marketplace_orders
  ADD COLUMN IF NOT EXISTS fulfillment_method text DEFAULT 'shipping'
    CHECK (fulfillment_method IN ('shipping','local_delivery')),
  ADD COLUMN IF NOT EXISTS delivery_scheduled_date date,
  ADD COLUMN IF NOT EXISTS delivery_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_driver_notes text;

CREATE TABLE IF NOT EXISTS public.dd_delivery_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_date date NOT NULL,
  driver_name text,
  status text DEFAULT 'planned'
    CHECK (status IN ('planned','in_progress','completed','cancelled')),
  order_ids uuid[] DEFAULT '{}',
  total_stops int DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_delivery_routes TO authenticated;
GRANT ALL ON public.dd_delivery_routes TO service_role;

ALTER TABLE public.dd_delivery_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access dd_delivery_routes"
  ON public.dd_delivery_routes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_dd_delivery_routes_date
  ON public.dd_delivery_routes(route_date DESC);

CREATE INDEX IF NOT EXISTS idx_mp_orders_local_delivery
  ON public.marketplace_orders(fulfillment_method, delivery_scheduled_date)
  WHERE fulfillment_method = 'local_delivery';