-- Create invoice_line_items table
CREATE TABLE public.invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  brand text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  line_total numeric NOT NULL,
  
  -- Add constraint to ensure quantity is positive
  CONSTRAINT positive_quantity CHECK (quantity > 0)
);

-- Create index for faster lookups by invoice
CREATE INDEX idx_invoice_line_items_invoice_id ON public.invoice_line_items(invoice_id);

-- Enable RLS
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can perform all operations
CREATE POLICY "Authenticated users can manage invoice line items" 
  ON public.invoice_line_items
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Add table comment for documentation
COMMENT ON TABLE public.invoice_line_items IS 'Stores individual product/item lines for each invoice';