-- Create store_orders table
CREATE TABLE public.store_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  hub_id UUID REFERENCES public.wholesale_hubs(id),
  driver_id UUID REFERENCES public.profiles(id),
  order_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'invoice', 'consignment')),
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC NOT NULL DEFAULT 0,
  delivery_fee NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  estimated_delivery TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  generated_by_ai BOOLEAN DEFAULT false,
  notes TEXT
);

-- Create store_order_items table
CREATE TABLE public.store_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  order_id UUID NOT NULL REFERENCES public.store_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  discount_percent NUMERIC DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100)
);

-- Create inventory_hubs table
CREATE TABLE public.inventory_hubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  hub_id UUID NOT NULL REFERENCES public.wholesale_hubs(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity_available INTEGER NOT NULL DEFAULT 0,
  quantity_reserved INTEGER NOT NULL DEFAULT 0,
  reorder_point INTEGER DEFAULT 50,
  max_stock INTEGER DEFAULT 500,
  last_restock_date DATE,
  UNIQUE(hub_id, product_id)
);

-- Create inventory_stores table
CREATE TABLE public.inventory_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity_current INTEGER NOT NULL DEFAULT 0,
  quantity_sold_last_30_days INTEGER DEFAULT 0,
  reorder_point INTEGER DEFAULT 10,
  consumption_rate_per_day NUMERIC DEFAULT 0,
  predicted_stockout_date DATE,
  last_order_date DATE,
  UNIQUE(store_id, product_id)
);

-- Create inventory_movements table
CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('order', 'delivery', 'return', 'adjustment', 'restock')),
  from_type TEXT CHECK (from_type IN ('hub', 'store', 'supplier')),
  from_id UUID,
  to_type TEXT CHECK (to_type IN ('hub', 'store', 'supplier')),
  to_id UUID,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL,
  order_id UUID REFERENCES public.store_orders(id),
  notes TEXT
);

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  invoice_number TEXT NOT NULL UNIQUE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.store_orders(id),
  total_amount NUMERIC NOT NULL,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'overdue')),
  payment_method TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Create store_wallet table
CREATE TABLE public.store_wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE UNIQUE,
  balance NUMERIC NOT NULL DEFAULT 0,
  credit_limit NUMERIC DEFAULT 0,
  total_spent NUMERIC NOT NULL DEFAULT 0,
  total_paid NUMERIC NOT NULL DEFAULT 0,
  payment_risk_score INTEGER DEFAULT 50 CHECK (payment_risk_score >= 0 AND payment_risk_score <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create store_transactions table
CREATE TABLE public.store_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES public.store_wallet(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('charge', 'payment', 'credit', 'adjustment')),
  amount NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id),
  order_id UUID REFERENCES public.store_orders(id),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_hubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for store_orders
CREATE POLICY "Stores can view their own orders"
  ON public.store_orders FOR SELECT
  USING (store_id IN (SELECT id FROM stores WHERE id = store_id) OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'csr')
  ));

CREATE POLICY "Stores can create orders"
  ON public.store_orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins and drivers can update orders"
  ON public.store_orders FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'csr', 'driver', 'biker')
  ));

-- RLS policies for store_order_items
CREATE POLICY "Anyone can view order items"
  ON public.store_order_items FOR SELECT
  USING (true);

CREATE POLICY "System can insert order items"
  ON public.store_order_items FOR INSERT
  WITH CHECK (true);

-- RLS policies for inventory
CREATE POLICY "Admins can manage hub inventory"
  ON public.inventory_hubs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Everyone can view hub inventory"
  ON public.inventory_hubs FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage store inventory"
  ON public.inventory_stores FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Stores can view their inventory"
  ON public.inventory_stores FOR SELECT
  USING (true);

-- RLS policies for invoices
CREATE POLICY "Stores can view their invoices"
  ON public.invoices FOR SELECT
  USING (store_id IN (SELECT id FROM stores WHERE id = store_id) OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'csr')
  ));

CREATE POLICY "Admins can manage invoices"
  ON public.invoices FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- RLS policies for wallet
CREATE POLICY "Stores can view their wallet"
  ON public.store_wallet FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage wallets"
  ON public.store_wallet FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- Create indexes
CREATE INDEX idx_store_orders_store_id ON public.store_orders(store_id);
CREATE INDEX idx_store_orders_status ON public.store_orders(status);
CREATE INDEX idx_store_orders_created_at ON public.store_orders(created_at DESC);
CREATE INDEX idx_store_order_items_order_id ON public.store_order_items(order_id);
CREATE INDEX idx_inventory_hubs_hub_product ON public.inventory_hubs(hub_id, product_id);
CREATE INDEX idx_inventory_stores_store_product ON public.inventory_stores(store_id, product_id);
CREATE INDEX idx_invoices_store_id ON public.invoices(store_id);
CREATE INDEX idx_invoices_payment_status ON public.invoices(payment_status);

-- Create trigger for updating updated_at
CREATE TRIGGER update_store_orders_updated_at
BEFORE UPDATE ON public.store_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_hubs_updated_at
BEFORE UPDATE ON public.inventory_hubs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_stores_updated_at
BEFORE UPDATE ON public.inventory_stores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_store_wallet_updated_at
BEFORE UPDATE ON public.store_wallet
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();