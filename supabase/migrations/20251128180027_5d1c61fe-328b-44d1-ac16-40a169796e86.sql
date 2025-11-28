
-- Production tables
CREATE TABLE IF NOT EXISTS public.production_offices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.production_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID REFERENCES public.production_offices(id),
  brand TEXT NOT NULL CHECK (brand IN ('gasmask', 'hotmama', 'hotscolati', 'grabba_r_us')),
  boxes_produced INTEGER DEFAULT 0,
  tubes_total INTEGER DEFAULT 0,
  shift_label TEXT,
  produced_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.production_tools_issued (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID REFERENCES public.production_offices(id),
  tool_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  issued_to TEXT,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  returned_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.machine_service_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID REFERENCES public.production_offices(id),
  machine_name TEXT NOT NULL,
  issue_description TEXT,
  service_action TEXT,
  serviced_by TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Driver tables
CREATE TABLE IF NOT EXISTS public.grabba_drivers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  region TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.driver_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID REFERENCES public.grabba_drivers(id),
  route_date DATE NOT NULL,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.driver_route_stops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID REFERENCES public.driver_routes(id),
  company_id UUID REFERENCES public.companies(id),
  store_id UUID REFERENCES public.stores(id),
  sequence INTEGER DEFAULT 0,
  task_type TEXT DEFAULT 'delivery' CHECK (task_type IN ('delivery', 'collection', 'visit')),
  brand TEXT,
  amount_owed NUMERIC(10,2),
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ambassador tables (extend existing)
CREATE TABLE IF NOT EXISTS public.ambassador_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ambassador_id UUID REFERENCES public.ambassadors(id),
  company_id UUID REFERENCES public.companies(id),
  wholesaler_id UUID,
  role_type TEXT DEFAULT 'store_finder' CHECK (role_type IN ('store_finder', 'store_maintenance', 'wholesaler_finder')),
  commission_rate NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Wholesale platform tables
CREATE TABLE IF NOT EXISTS public.wholesalers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'banned')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wholesale_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wholesaler_id UUID REFERENCES public.wholesalers(id),
  name TEXT NOT NULL,
  category TEXT,
  brand_name TEXT,
  unit_price NUMERIC(10,2),
  case_quantity INTEGER DEFAULT 1,
  stock INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wholesale_orders_platform (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_company_id UUID REFERENCES public.companies(id),
  wholesaler_id UUID REFERENCES public.wholesalers(id),
  total_amount NUMERIC(10,2),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'shipped', 'delivered')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wholesale_ai_sourcing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_name TEXT NOT NULL,
  category TEXT,
  suggested_supplier TEXT,
  supplier_cost NUMERIC(10,2),
  suggested_resale_price NUMERIC(10,2),
  status TEXT DEFAULT 'idea' CHECK (status IN ('idea', 'testing', 'live')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.production_offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_tools_issued ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_service_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grabba_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambassador_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesalers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_orders_platform ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_ai_sourcing ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Allow authenticated read production_offices" ON public.production_offices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert production_offices" ON public.production_offices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update production_offices" ON public.production_offices FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read production_batches" ON public.production_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert production_batches" ON public.production_batches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update production_batches" ON public.production_batches FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read production_tools_issued" ON public.production_tools_issued FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert production_tools_issued" ON public.production_tools_issued FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update production_tools_issued" ON public.production_tools_issued FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read machine_service_logs" ON public.machine_service_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert machine_service_logs" ON public.machine_service_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update machine_service_logs" ON public.machine_service_logs FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read grabba_drivers" ON public.grabba_drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert grabba_drivers" ON public.grabba_drivers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update grabba_drivers" ON public.grabba_drivers FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read driver_routes" ON public.driver_routes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert driver_routes" ON public.driver_routes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update driver_routes" ON public.driver_routes FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read driver_route_stops" ON public.driver_route_stops FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert driver_route_stops" ON public.driver_route_stops FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update driver_route_stops" ON public.driver_route_stops FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read ambassador_assignments" ON public.ambassador_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert ambassador_assignments" ON public.ambassador_assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update ambassador_assignments" ON public.ambassador_assignments FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read wholesalers" ON public.wholesalers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert wholesalers" ON public.wholesalers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update wholesalers" ON public.wholesalers FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read wholesale_products" ON public.wholesale_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert wholesale_products" ON public.wholesale_products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update wholesale_products" ON public.wholesale_products FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read wholesale_orders_platform" ON public.wholesale_orders_platform FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert wholesale_orders_platform" ON public.wholesale_orders_platform FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update wholesale_orders_platform" ON public.wholesale_orders_platform FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read wholesale_ai_sourcing" ON public.wholesale_ai_sourcing FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert wholesale_ai_sourcing" ON public.wholesale_ai_sourcing FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update wholesale_ai_sourcing" ON public.wholesale_ai_sourcing FOR UPDATE TO authenticated USING (true);
