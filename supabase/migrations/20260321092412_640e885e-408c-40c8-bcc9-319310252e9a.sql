
-- Additional stores captured during checklist
CREATE TABLE IF NOT EXISTS public.checklist_additional_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id),
  person_type text NOT NULL,
  store_name text,
  telephone text,
  address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.checklist_additional_stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage checklist_additional_stores"
  ON public.checklist_additional_stores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Delivery orders created from checklist
CREATE TABLE IF NOT EXISTS public.checklist_delivery_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id),
  person_type text NOT NULL,
  delivering_to_store text,
  invoice_number text UNIQUE,
  delivery_date date DEFAULT current_date,
  payment_terms text DEFAULT 'Net 30',
  status text DEFAULT 'draft',
  subtotal numeric(10,2) DEFAULT 0,
  total numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.checklist_delivery_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage checklist_delivery_orders"
  ON public.checklist_delivery_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Line items for delivery orders
CREATE TABLE IF NOT EXISTS public.checklist_delivery_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.checklist_delivery_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  product_name text NOT NULL,
  brand text NOT NULL,
  sku text NOT NULL,
  qty integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL,
  line_total numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.checklist_delivery_order_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage checklist_delivery_order_lines"
  ON public.checklist_delivery_order_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tube counts per product per visit
CREATE TABLE IF NOT EXISTS public.checklist_tube_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id),
  person_type text NOT NULL,
  product_id uuid REFERENCES public.products(id),
  product_name text NOT NULL,
  brand text NOT NULL,
  sku text NOT NULL,
  count integer DEFAULT 0,
  notes text,
  visit_date date DEFAULT current_date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(store_id, person_type, product_id, visit_date)
);
ALTER TABLE public.checklist_tube_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage checklist_tube_counts"
  ON public.checklist_tube_counts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Inventory photos
CREATE TABLE IF NOT EXISTS public.checklist_inventory_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id),
  person_type text NOT NULL,
  file_path text NOT NULL,
  file_name text,
  visit_date date DEFAULT current_date,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.checklist_inventory_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage checklist_inventory_photos"
  ON public.checklist_inventory_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket for checklist photos
INSERT INTO storage.buckets (id, name, public) VALUES ('checklist-photos', 'checklist-photos', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload checklist photos"
  ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'checklist-photos');
CREATE POLICY "Anyone can view checklist photos"
  ON storage.objects FOR SELECT TO public USING (bucket_id = 'checklist-photos');
CREATE POLICY "Authenticated users can delete checklist photos"
  ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'checklist-photos');
