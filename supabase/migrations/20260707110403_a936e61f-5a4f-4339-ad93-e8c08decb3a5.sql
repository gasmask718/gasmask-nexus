
-- 1. products_all dimension columns
ALTER TABLE public.products_all
  ADD COLUMN IF NOT EXISTS length_in numeric,
  ADD COLUMN IF NOT EXISTS width_in numeric,
  ADD COLUMN IF NOT EXISTS height_in numeric,
  ADD COLUMN IF NOT EXISTS weight_oz numeric,
  ADD COLUMN IF NOT EXISTS units_per_case integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS case_length_in numeric,
  ADD COLUMN IF NOT EXISTS case_width_in numeric,
  ADD COLUMN IF NOT EXISTS case_height_in numeric,
  ADD COLUMN IF NOT EXISTS case_weight_oz numeric,
  ADD COLUMN IF NOT EXISTS is_fragile boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stackable boolean DEFAULT true;

-- 2. dd_box_sizes
CREATE TABLE IF NOT EXISTS public.dd_box_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_name text NOT NULL,
  carrier text DEFAULT 'any' CHECK (carrier IN ('any','ups','fedex','usps','own')),
  length_in numeric NOT NULL,
  width_in numeric NOT NULL,
  height_in numeric NOT NULL,
  max_weight_oz numeric NOT NULL,
  is_flat_rate boolean DEFAULT false,
  flat_rate_price numeric,
  cost_per_box numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_box_sizes TO authenticated;
GRANT ALL ON public.dd_box_sizes TO service_role;
ALTER TABLE public.dd_box_sizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read box sizes" ON public.dd_box_sizes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage box sizes" ON public.dd_box_sizes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access box sizes" ON public.dd_box_sizes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. dd_shipments
CREATE TABLE IF NOT EXISTS public.dd_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  wholesaler_id uuid,
  store_id uuid,
  carrier text NOT NULL,
  service_level text,
  tracking_number text,
  label_url text,
  label_pdf_url text,
  easypost_shipment_id text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','label_created','picked_up','in_transit','out_for_delivery','delivered','exception','returned')),
  estimated_delivery date,
  actual_delivery timestamptz,
  weight_oz numeric,
  length_in numeric,
  width_in numeric,
  height_in numeric,
  rate_selected numeric,
  rates_compared jsonb,
  from_address jsonb,
  to_address jsonb,
  packing_result jsonb,
  box_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_shipments TO authenticated;
GRANT ALL ON public.dd_shipments TO service_role;
ALTER TABLE public.dd_shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read shipments" ON public.dd_shipments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage shipments" ON public.dd_shipments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access shipments" ON public.dd_shipments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. dd_pickup_schedules
CREATE TABLE IF NOT EXISTS public.dd_pickup_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wholesaler_id uuid NOT NULL,
  carrier text NOT NULL,
  easypost_pickup_id text,
  pickup_date date NOT NULL,
  pickup_window_start time,
  pickup_window_end time,
  pickup_address jsonb,
  shipment_ids text[],
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled','confirmed','completed','cancelled')),
  instructions text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_pickup_schedules TO authenticated;
GRANT ALL ON public.dd_pickup_schedules TO service_role;
ALTER TABLE public.dd_pickup_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read pickup schedules" ON public.dd_pickup_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage pickup schedules" ON public.dd_pickup_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access pickup schedules" ON public.dd_pickup_schedules FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. dd_shipping_accounts
CREATE TABLE IF NOT EXISTS public.dd_shipping_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wholesaler_id uuid,
  carrier text NOT NULL CHECK (carrier IN ('ups','fedex','usps','ontrac','lso')),
  account_number text,
  pickup_scheduled boolean DEFAULT false,
  pickup_time_window text,
  pickup_address jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_shipping_accounts TO authenticated;
GRANT ALL ON public.dd_shipping_accounts TO service_role;
ALTER TABLE public.dd_shipping_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read shipping accounts" ON public.dd_shipping_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage shipping accounts" ON public.dd_shipping_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access shipping accounts" ON public.dd_shipping_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);
