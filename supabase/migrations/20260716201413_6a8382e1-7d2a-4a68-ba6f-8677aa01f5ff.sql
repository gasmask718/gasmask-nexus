
CREATE TABLE public.store_samples_given (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  product_id UUID,
  brand TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  given_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  given_by UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_store_samples_given_store ON public.store_samples_given(store_id, given_at DESC);
CREATE INDEX idx_store_samples_given_product ON public.store_samples_given(product_id);
CREATE INDEX idx_store_samples_given_brand ON public.store_samples_given(brand);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_samples_given TO authenticated;
GRANT ALL ON public.store_samples_given TO service_role;

ALTER TABLE public.store_samples_given ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read samples given"
  ON public.store_samples_given FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert samples given"
  ON public.store_samples_given FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Author or admin can update samples given"
  ON public.store_samples_given FOR UPDATE
  TO authenticated
  USING (given_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (given_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Author or admin can delete samples given"
  ON public.store_samples_given FOR DELETE
  TO authenticated
  USING (given_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- Per-brand aggregate view: distinct stores that have received a sample per brand
CREATE OR REPLACE VIEW public.samples_given_by_brand_v AS
SELECT
  COALESCE(sg.brand, 'unknown') AS brand,
  sg.product_id,
  COUNT(DISTINCT sg.store_id) AS distinct_stores,
  SUM(sg.quantity) AS total_units,
  COUNT(*) AS event_count,
  MAX(sg.given_at) AS last_given_at
FROM public.store_samples_given sg
GROUP BY COALESCE(sg.brand, 'unknown'), sg.product_id;

GRANT SELECT ON public.samples_given_by_brand_v TO authenticated;
