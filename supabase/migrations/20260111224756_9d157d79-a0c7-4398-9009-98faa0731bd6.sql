-- =============================================
-- PRODUCT CONVERSIONS TABLE (Floor 3 - Inventory Engine)
-- Defines how BOX, HALF_BOX, TUBE convert to base unit (TUBES)
-- =============================================

CREATE TABLE public.product_conversions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand TEXT NOT NULL,
  product_name TEXT NOT NULL,
  unit_type TEXT NOT NULL CHECK (unit_type IN ('BOX', 'HALF_BOX', 'TUBE')),
  tubes_per_unit NUMERIC NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(brand, product_name, unit_type)
);

-- Enable RLS
ALTER TABLE public.product_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product conversions"
  ON public.product_conversions FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage product conversions"
  ON public.product_conversions FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_product_conversions_updated_at
  BEFORE UPDATE ON public.product_conversions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- ADD MISSING COLUMNS TO INVOICE LINE ITEMS
-- =============================================

ALTER TABLE public.invoice_line_items 
  ADD COLUMN IF NOT EXISTS unit_type TEXT NOT NULL DEFAULT 'TUBE' CHECK (unit_type IN ('BOX', 'HALF_BOX', 'TUBE'));

ALTER TABLE public.invoice_line_items 
  ADD COLUMN IF NOT EXISTS tubes_equivalent NUMERIC;

-- Rename brand_name to brand for consistency if it exists
ALTER TABLE public.invoice_line_items 
  RENAME COLUMN brand_name TO brand;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_brand ON public.invoice_line_items(brand);

-- =============================================
-- FUNCTION: Compute tubes equivalent for a line item
-- =============================================

CREATE OR REPLACE FUNCTION public.compute_tubes_equivalent()
RETURNS TRIGGER AS $$
DECLARE
  conversion_rate NUMERIC;
BEGIN
  SELECT tubes_per_unit INTO conversion_rate
  FROM public.product_conversions
  WHERE brand = NEW.brand
    AND product_name = NEW.product_name
    AND unit_type = NEW.unit_type
    AND is_active = true
  LIMIT 1;
  
  IF conversion_rate IS NULL THEN
    conversion_rate := 1;
  END IF;
  
  NEW.tubes_equivalent := NEW.quantity * conversion_rate;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-compute tubes on insert/update
DROP TRIGGER IF EXISTS compute_line_item_tubes ON public.invoice_line_items;
CREATE TRIGGER compute_line_item_tubes
  BEFORE INSERT OR UPDATE ON public.invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_tubes_equivalent();

-- =============================================
-- VIEW: Tube Counter (Derived from invoices)
-- =============================================

CREATE OR REPLACE VIEW public.tube_counter AS
SELECT 
  i.store_id,
  li.brand,
  li.product_name,
  DATE(i.created_at) as sale_date,
  i.payment_status,
  SUM(li.tubes_equivalent) as total_tubes,
  SUM(li.quantity) as total_units,
  SUM(li.total) as total_revenue,
  COUNT(DISTINCT i.id) as invoice_count
FROM public.invoice_line_items li
JOIN public.invoices i ON li.invoice_id = i.id
WHERE i.store_id IS NOT NULL
GROUP BY i.store_id, li.brand, li.product_name, DATE(i.created_at), i.payment_status;