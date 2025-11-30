-- Create orders table
CREATE TABLE public.orders (
  -- Identity
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_code text UNIQUE,
  external_ref text,

  -- Brand / business context
  brand_key text NOT NULL,
  order_type order_type NOT NULL DEFAULT 'product',
  fulfillment_type fulfillment_type NOT NULL DEFAULT 'shipping',
  channel order_channel NOT NULL DEFAULT 'web',

  -- Link to businesses table
  business_id uuid REFERENCES public.businesses(id),

  -- Customer snapshot
  customer_id uuid,
  customer_type text,
  customer_name text,
  customer_email text,
  customer_phone text,
  customer_company text,

  -- Location / store context
  store_id uuid REFERENCES public.stores(id),
  wholesaler_id uuid,
  address_snapshot jsonb,

  -- Financials
  currency char(3) NOT NULL DEFAULT 'USD',
  subtotal_amount numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  shipping_amount numeric(12,2) NOT NULL DEFAULT 0,
  service_fee_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  balance_due numeric(12,2) NOT NULL DEFAULT 0,

  order_status order_status NOT NULL DEFAULT 'pending',
  payment_status payment_status NOT NULL DEFAULT 'unpaid',

  -- Time fields
  placed_at timestamptz NOT NULL DEFAULT now(),
  scheduled_at timestamptz,
  due_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  cancel_reason text,

  -- Assignment & ops
  created_by uuid REFERENCES public.profiles(id),
  updated_by uuid REFERENCES public.profiles(id),
  assigned_to uuid REFERENCES public.profiles(id),
  driver_id uuid,
  biker_id uuid,
  ambassador_id uuid REFERENCES public.ambassadors(id),
  affiliate_id uuid,

  -- Metadata for funnels & analytics
  source_campaign text,
  source_note text,
  tags text[] DEFAULT '{}',

  -- Notes
  internal_notes text,
  customer_notes text,

  -- JSON for brand-specific detail pointer
  detail_ref jsonb,

  -- System fields
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Keep updated_at fresh
CREATE TRIGGER set_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for common queries
CREATE INDEX idx_orders_brand_key ON public.orders(brand_key);
CREATE INDEX idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX idx_orders_store_id ON public.orders(store_id);
CREATE INDEX idx_orders_order_status ON public.orders(order_status);
CREATE INDEX idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX idx_orders_placed_at ON public.orders(placed_at DESC);
CREATE INDEX idx_orders_business_id ON public.orders(business_id);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Admin policy: Admins can manage all orders
CREATE POLICY "Admins can manage all orders"
ON public.orders
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
  )
);

-- Users can view orders they created or are assigned to
CREATE POLICY "Users can view own orders"
ON public.orders
FOR SELECT
USING (
  auth.uid() = created_by 
  OR auth.uid() = assigned_to
);