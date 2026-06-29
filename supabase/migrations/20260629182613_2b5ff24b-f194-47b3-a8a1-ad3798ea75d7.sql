CREATE TABLE IF NOT EXISTS public.dd_flash_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  discount_pct numeric NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  product_ids uuid[] DEFAULT '{}',
  category_filter text,
  max_uses int,
  uses_count int DEFAULT 0,
  show_countdown bool DEFAULT true,
  banner_text text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','active','ended','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dd_flash_sales TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_flash_sales TO authenticated;
GRANT ALL ON public.dd_flash_sales TO service_role;

ALTER TABLE public.dd_flash_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active" ON public.dd_flash_sales;
CREATE POLICY "Public read active" ON public.dd_flash_sales
  FOR SELECT USING (status = 'active' AND starts_at <= now() AND ends_at > now());

DROP POLICY IF EXISTS "Admin full access" ON public.dd_flash_sales;
CREATE POLICY "Admin full access" ON public.dd_flash_sales
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS dd_flash_sales_active_idx
  ON public.dd_flash_sales (status, starts_at, ends_at);

CREATE OR REPLACE FUNCTION public.dd_flash_sales_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS dd_flash_sales_updated_at ON public.dd_flash_sales;
CREATE TRIGGER dd_flash_sales_updated_at
  BEFORE UPDATE ON public.dd_flash_sales
  FOR EACH ROW EXECUTE FUNCTION public.dd_flash_sales_touch_updated_at();

-- Server-side helper: returns the best active flash-sale discount % for a given product
CREATE OR REPLACE FUNCTION public.dd_active_flash_sale_for_product(p_product_id uuid)
RETURNS TABLE(id uuid, discount_pct numeric, ends_at timestamptz, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT fs.id, fs.discount_pct, fs.ends_at, fs.name
  FROM public.dd_flash_sales fs
  WHERE fs.status = 'active'
    AND fs.starts_at <= now()
    AND fs.ends_at > now()
    AND (fs.max_uses IS NULL OR fs.uses_count < fs.max_uses)
    AND (
      coalesce(array_length(fs.product_ids, 1), 0) = 0
      OR p_product_id = ANY (fs.product_ids)
    )
  ORDER BY fs.discount_pct DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.dd_active_flash_sale_for_product(uuid) TO anon, authenticated, service_role;