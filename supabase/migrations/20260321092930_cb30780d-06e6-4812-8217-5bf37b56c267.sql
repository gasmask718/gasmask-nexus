
CREATE TABLE IF NOT EXISTS public.checklist_tube_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id),
  person_type text NOT NULL,
  product_name text NOT NULL,
  status text DEFAULT 'inactive',
  tube_count integer DEFAULT 0,
  last_order_date date,
  last_order_qty integer,
  needs_order boolean DEFAULT false,
  bring_starter_kit boolean DEFAULT false,
  bring_samples boolean DEFAULT false,
  switch_tubes boolean DEFAULT false,
  interest text,
  visit_date date DEFAULT current_date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(store_id, person_type, product_name, visit_date)
);
ALTER TABLE public.checklist_tube_intelligence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage checklist_tube_intelligence"
  ON public.checklist_tube_intelligence FOR ALL TO authenticated USING (true) WITH CHECK (true);
