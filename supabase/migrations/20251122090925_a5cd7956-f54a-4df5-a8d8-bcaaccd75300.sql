-- Create crm_customers table
CREATE TABLE IF NOT EXISTS public.crm_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  business_type TEXT CHECK (business_type IN ('store','wholesaler','direct_buyer')),
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  notes TEXT,
  relationship_status TEXT DEFAULT 'active' CHECK (relationship_status IN ('active','warm','cold','lost')),
  last_order_date DATE,
  total_lifetime_value NUMERIC DEFAULT 0
);

-- Create customer_orders table
CREATE TABLE IF NOT EXISTS public.customer_orders(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  customer_id UUID REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  items JSONB DEFAULT '[]',
  subtotal NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  payment_method TEXT,
  notes TEXT
);

-- Create customer_invoices table
CREATE TABLE IF NOT EXISTS public.customer_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  customer_id UUID REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  invoice_number TEXT,
  invoice_date DATE DEFAULT CURRENT_DATE,
  total_amount NUMERIC DEFAULT 0,
  status TEXT CHECK (status IN ('draft','sent','paid','overdue')) DEFAULT 'sent',
  pdf_url TEXT
);

-- Create customer_receipts table
CREATE TABLE IF NOT EXISTS public.customer_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  customer_id UUID REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  receipt_number TEXT,
  receipt_date DATE DEFAULT CURRENT_DATE,
  amount_paid NUMERIC DEFAULT 0,
  payment_method TEXT,
  pdf_url TEXT
);

-- Create customer_files table
CREATE TABLE IF NOT EXISTS public.customer_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  customer_id UUID REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  file_name TEXT,
  file_type TEXT,
  file_url TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customer_orders_customer ON public.customer_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_customer ON public.customer_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_receipts_customer ON public.customer_receipts(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_files_customer ON public.customer_files(customer_id);

-- Enable RLS
ALTER TABLE public.crm_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage customers"
  ON public.crm_customers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage customer orders"
  ON public.customer_orders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage customer invoices"
  ON public.customer_invoices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage customer receipts"
  ON public.customer_receipts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage customer files"
  ON public.customer_files FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Create storage bucket for customer documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-documents', 'customer-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Admins can upload customer documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'customer-documents' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can view customer documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'customer-documents' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete customer documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'customer-documents' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Function to update updated_at
CREATE OR REPLACE FUNCTION public.update_crm_customer_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_crm_customers_updated_at
  BEFORE UPDATE ON public.crm_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_crm_customer_timestamp();