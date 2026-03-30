
-- UT Business Builder: only create tables that don't exist yet

CREATE TABLE IF NOT EXISTS public.ut_business_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  phone text,
  location text,
  selected_items jsonb DEFAULT '[]'::jsonb,
  estimated_budget numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ut_business_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.ut_business_requests(id) ON DELETE CASCADE NOT NULL,
  product_cost numeric NOT NULL DEFAULT 0,
  shipping_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  estimated_delivery_days int DEFAULT 14,
  notes text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ut_business_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  items jsonb DEFAULT '[]'::jsonb,
  estimated_cost numeric NOT NULL DEFAULT 0,
  estimated_monthly_profit numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_ut_biz_req_status ON public.ut_business_requests(status);
CREATE INDEX IF NOT EXISTS idx_ut_biz_req_created ON public.ut_business_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ut_biz_quotes_request ON public.ut_business_quotes(request_id);

-- RLS
ALTER TABLE public.ut_business_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_business_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_business_packages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ut_business_requests' AND policyname='Authenticated read ut_business_requests') THEN
    CREATE POLICY "Authenticated read ut_business_requests" ON public.ut_business_requests FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ut_business_requests' AND policyname='Authenticated insert ut_business_requests') THEN
    CREATE POLICY "Authenticated insert ut_business_requests" ON public.ut_business_requests FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ut_business_requests' AND policyname='Authenticated update ut_business_requests') THEN
    CREATE POLICY "Authenticated update ut_business_requests" ON public.ut_business_requests FOR UPDATE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ut_business_requests' AND policyname='Anon insert ut_business_requests') THEN
    CREATE POLICY "Anon insert ut_business_requests" ON public.ut_business_requests FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ut_business_quotes' AND policyname='Auth read ut_business_quotes') THEN
    CREATE POLICY "Auth read ut_business_quotes" ON public.ut_business_quotes FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ut_business_quotes' AND policyname='Auth insert ut_business_quotes') THEN
    CREATE POLICY "Auth insert ut_business_quotes" ON public.ut_business_quotes FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ut_business_quotes' AND policyname='Auth update ut_business_quotes') THEN
    CREATE POLICY "Auth update ut_business_quotes" ON public.ut_business_quotes FOR UPDATE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ut_business_packages' AND policyname='Auth read ut_business_packages') THEN
    CREATE POLICY "Auth read ut_business_packages" ON public.ut_business_packages FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ut_business_packages' AND policyname='Auth manage ut_business_packages') THEN
    CREATE POLICY "Auth manage ut_business_packages" ON public.ut_business_packages FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ut_business_requests;
