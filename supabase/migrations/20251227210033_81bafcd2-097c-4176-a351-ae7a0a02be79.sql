-- Create visit_products table to store products given during visits
-- This is the single source of truth for product assignments to stores

CREATE TABLE IF NOT EXISTS public.visit_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID NOT NULL REFERENCES public.visit_logs(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_type TEXT NOT NULL DEFAULT 'standard' CHECK (unit_type IN ('standard', 'custom')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for performance
CREATE INDEX idx_visit_products_visit_id ON public.visit_products(visit_id);
CREATE INDEX idx_visit_products_store_id ON public.visit_products(store_id);
CREATE INDEX idx_visit_products_brand_id ON public.visit_products(brand_id);
CREATE INDEX idx_visit_products_product_id ON public.visit_products(product_id);
CREATE INDEX idx_visit_products_created_at ON public.visit_products(created_at DESC);

-- Enable RLS
ALTER TABLE public.visit_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all visit products"
ON public.visit_products FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create visit products"
ON public.visit_products FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own visit products"
ON public.visit_products FOR UPDATE
USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Users can delete their own visit products"
ON public.visit_products FOR DELETE
USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

-- Add comment for documentation
COMMENT ON TABLE public.visit_products IS 'Products given to stores during visits - single source of truth for inventory assignments';

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.visit_products;