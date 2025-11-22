-- Create wholesale products table
CREATE TABLE IF NOT EXISTS public.wholesale_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wholesaler_id UUID NOT NULL REFERENCES public.wholesale_hubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  category TEXT NOT NULL,
  brand_id UUID REFERENCES public.brands(id),
  price NUMERIC NOT NULL,
  case_size INTEGER NOT NULL DEFAULT 1,
  stock INTEGER NOT NULL DEFAULT 0,
  eta_delivery_days INTEGER NOT NULL DEFAULT 3,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create wholesale orders table
CREATE TABLE IF NOT EXISTS public.wholesale_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  wholesaler_id UUID NOT NULL REFERENCES public.wholesale_hubs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'picked_up', 'out_for_delivery', 'delivered', 'canceled')),
  delivery_method TEXT NOT NULL DEFAULT 'gasmask_driver' CHECK (delivery_method IN ('gasmask_driver', 'wholesaler_driver', 'rideshare')),
  subtotal NUMERIC NOT NULL DEFAULT 0,
  commission_percentage NUMERIC NOT NULL DEFAULT 10,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  route_id UUID REFERENCES public.routes(id),
  driver_id UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ
);

-- Create wholesale order items table
CREATE TABLE IF NOT EXISTS public.wholesale_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.wholesale_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.wholesale_products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create store rewards table
CREATE TABLE IF NOT EXISTS public.store_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'diamond')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create ambassadors table
CREATE TABLE IF NOT EXISTS public.ambassadors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  tracking_code TEXT NOT NULL UNIQUE,
  total_earnings NUMERIC NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'starter' CHECK (tier IN ('starter', 'rising', 'elite', 'legendary')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create ambassador links table
CREATE TABLE IF NOT EXISTS public.ambassador_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id UUID NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('store', 'wholesaler')),
  entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ambassador_id, entity_type, entity_id)
);

-- Create ambassador commissions table
CREATE TABLE IF NOT EXISTS public.ambassador_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id UUID NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.wholesale_orders(id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('store_signup', 'wholesaler_signup', 'order', 'mission', 'product_intro')),
  entity_id UUID,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'canceled')),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create expansion scores table
CREATE TABLE IF NOT EXISTS public.expansion_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_type TEXT NOT NULL CHECK (location_type IN ('city', 'zip', 'street')),
  location_name TEXT NOT NULL,
  state TEXT,
  score INTEGER NOT NULL,
  expected_roi NUMERIC,
  priority INTEGER,
  driver_capacity_needed INTEGER,
  reasoning TEXT,
  recommendations JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_wholesale_products_wholesaler ON public.wholesale_products(wholesaler_id);
CREATE INDEX IF NOT EXISTS idx_wholesale_products_category ON public.wholesale_products(category);
CREATE INDEX IF NOT EXISTS idx_wholesale_products_active ON public.wholesale_products(is_active);
CREATE INDEX IF NOT EXISTS idx_wholesale_orders_store ON public.wholesale_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_wholesale_orders_wholesaler ON public.wholesale_orders(wholesaler_id);
CREATE INDEX IF NOT EXISTS idx_wholesale_orders_status ON public.wholesale_orders(status);
CREATE INDEX IF NOT EXISTS idx_wholesale_orders_driver ON public.wholesale_orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_wholesale_order_items_order ON public.wholesale_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_store_rewards_store ON public.store_rewards(store_id);
CREATE INDEX IF NOT EXISTS idx_ambassadors_user ON public.ambassadors(user_id);
CREATE INDEX IF NOT EXISTS idx_ambassadors_tracking ON public.ambassadors(tracking_code);
CREATE INDEX IF NOT EXISTS idx_ambassador_links_ambassador ON public.ambassador_links(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_ambassador_commissions_ambassador ON public.ambassador_commissions(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_ambassador_commissions_status ON public.ambassador_commissions(status);
CREATE INDEX IF NOT EXISTS idx_expansion_scores_type ON public.expansion_scores(location_type);
CREATE INDEX IF NOT EXISTS idx_expansion_scores_priority ON public.expansion_scores(priority);

-- Create triggers for updated_at
CREATE TRIGGER update_wholesale_products_updated_at
  BEFORE UPDATE ON public.wholesale_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wholesale_orders_updated_at
  BEFORE UPDATE ON public.wholesale_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_store_rewards_updated_at
  BEFORE UPDATE ON public.store_rewards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ambassadors_updated_at
  BEFORE UPDATE ON public.ambassadors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expansion_scores_updated_at
  BEFORE UPDATE ON public.expansion_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.wholesale_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambassadors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambassador_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambassador_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expansion_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wholesale_products
CREATE POLICY "Anyone can view active products"
  ON public.wholesale_products FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage all products"
  ON public.wholesale_products FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- RLS Policies for wholesale_orders
CREATE POLICY "Users can view their related orders"
  ON public.wholesale_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    OR driver_id = auth.uid()
  );

CREATE POLICY "Authenticated users can create orders"
  ON public.wholesale_orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins and drivers can update orders"
  ON public.wholesale_orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    OR driver_id = auth.uid()
  );

-- RLS Policies for wholesale_order_items
CREATE POLICY "Users can view order items"
  ON public.wholesale_order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.wholesale_orders
      WHERE wholesale_orders.id = order_id
      AND (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
        OR wholesale_orders.driver_id = auth.uid()
      )
    )
  );

CREATE POLICY "Authenticated users can create order items"
  ON public.wholesale_order_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for store_rewards
CREATE POLICY "Anyone can view store rewards"
  ON public.store_rewards FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can manage store rewards"
  ON public.store_rewards FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- RLS Policies for ambassadors
CREATE POLICY "Ambassadors can view their own profile"
  ON public.ambassadors FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Admins can manage ambassadors"
  ON public.ambassadors FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- RLS Policies for ambassador_links
CREATE POLICY "Ambassadors can view their links"
  ON public.ambassador_links FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ambassadors
      WHERE ambassadors.id = ambassador_id
      AND (ambassadors.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
    )
  );

CREATE POLICY "System can create ambassador links"
  ON public.ambassador_links FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for ambassador_commissions
CREATE POLICY "Ambassadors can view their commissions"
  ON public.ambassador_commissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ambassadors
      WHERE ambassadors.id = ambassador_id
      AND (ambassadors.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
    )
  );

CREATE POLICY "System can create commissions"
  ON public.ambassador_commissions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update commissions"
  ON public.ambassador_commissions FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- RLS Policies for expansion_scores
CREATE POLICY "Admins can manage expansion scores"
  ON public.expansion_scores FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));