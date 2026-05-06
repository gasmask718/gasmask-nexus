CREATE TABLE IF NOT EXISTS public.brandaro_sales_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price_label text NOT NULL,
  price_numeric numeric,
  payment_terms text NOT NULL,
  highlights text NOT NULL,
  best_for text NOT NULL,
  is_target boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brandaro_sales_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read packages"
  ON public.brandaro_sales_packages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service can manage packages"
  ON public.brandaro_sales_packages FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_brandaro_sales_packages_updated_at
  BEFORE UPDATE ON public.brandaro_sales_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();