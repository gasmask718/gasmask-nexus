
-- DYNASTY OS — COMPANY MODEL (Step 2: Add company_id to existing tables and create new tables)

-- Add company_id to stores
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Add company_id to wholesale_orders
ALTER TABLE public.wholesale_orders ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.wholesale_orders ADD COLUMN IF NOT EXISTS customer_type text DEFAULT 'store';

-- Add company_id to store_payments
ALTER TABLE public.store_payments ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.store_payments ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'cash';

-- Add company_id to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_type text DEFAULT 'store';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax numeric DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS total numeric DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_pdf_url text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS created_by text;

-- Create wholesaler_accounts table
CREATE TABLE IF NOT EXISTS public.wholesaler_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  contact_name text,
  phone text,
  email text,
  region text,
  commission_rate numeric DEFAULT 0,
  payment_terms text DEFAULT 'net_30',
  notes text,
  is_active boolean DEFAULT true,
  created_by text NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.wholesaler_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage wholesaler_accounts" ON public.wholesaler_accounts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view wholesaler_accounts" ON public.wholesaler_accounts FOR SELECT USING (auth.uid() IS NOT NULL);

-- Create direct_customers table
CREATE TABLE IF NOT EXISTS public.direct_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  channel text,
  auth_user_id uuid NULL,
  vip_status boolean DEFAULT false,
  notes text,
  created_by text NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.direct_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage direct_customers" ON public.direct_customers FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view direct_customers" ON public.direct_customers FOR SELECT USING (auth.uid() IS NOT NULL);

-- Create company_contacts table
CREATE TABLE IF NOT EXISTS public.company_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) NOT NULL,
  name text NOT NULL,
  role text DEFAULT 'contact',
  phone text,
  email text,
  is_primary boolean DEFAULT false,
  can_receive_sms boolean DEFAULT true,
  can_receive_email boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.company_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage company_contacts" ON public.company_contacts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view company_contacts" ON public.company_contacts FOR SELECT USING (auth.uid() IS NOT NULL);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_stores_company_id ON public.stores(company_id);
CREATE INDEX IF NOT EXISTS idx_wholesale_orders_company_id ON public.wholesale_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_store_payments_company_id ON public.store_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_company_contacts_company_id ON public.company_contacts(company_id);
