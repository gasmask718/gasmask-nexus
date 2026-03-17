
-- Client Services (recurring revenue stack per client)
CREATE TABLE public.brandaro_client_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.brandaro_leads_master(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  monthly_value NUMERIC DEFAULT 0,
  active BOOLEAN DEFAULT true,
  started_at TIMESTAMPTZ DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_client_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage client services" ON public.brandaro_client_services FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Industry Performance tracking
CREATE TABLE public.brandaro_industry_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry TEXT NOT NULL UNIQUE,
  close_rate NUMERIC DEFAULT 0,
  avg_revenue NUMERIC DEFAULT 0,
  total_clients INTEGER DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  avg_ltv NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_industry_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage industry performance" ON public.brandaro_industry_performance FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed industry data
INSERT INTO public.brandaro_industry_performance (industry, close_rate, avg_revenue, total_clients, total_revenue, avg_ltv) VALUES
  ('smoke_shop', 18.5, 1800, 12, 21600, 8500),
  ('cleaning', 15.2, 1500, 8, 12000, 6200),
  ('plumbing', 12.8, 2200, 6, 13200, 9800),
  ('roofing', 14.1, 2500, 5, 12500, 11000),
  ('hvac', 11.5, 2000, 4, 8000, 7500),
  ('med_spa', 16.3, 3000, 7, 21000, 14000),
  ('landscaping', 13.0, 1200, 3, 3600, 4800),
  ('restaurant', 10.5, 1600, 5, 8000, 5500);
