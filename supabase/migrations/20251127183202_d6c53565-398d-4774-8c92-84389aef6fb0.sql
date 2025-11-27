
-- DYNASTY OS — COMPANY MODEL (Step 1: Create companies table only)
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  name text NOT NULL,
  brand_focus text[] NULL,
  default_city text NULL,
  default_state text NULL,
  default_billing_address text NULL,
  default_phone text NULL,
  default_email text NULL,
  notes text NULL,
  tags text[] NULL,
  total_revenue numeric DEFAULT 0,
  total_orders integer DEFAULT 0,
  health_score integer DEFAULT 50,
  created_by text NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage companies" ON public.companies FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users view companies" ON public.companies FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_companies_type ON public.companies(type);
