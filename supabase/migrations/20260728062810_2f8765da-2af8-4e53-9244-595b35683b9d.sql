CREATE TABLE public.store_brand_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  flag_type text NOT NULL CHECK (flag_type IN ('needs_order','bring_samples')),
  set_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, brand_id, flag_type)
);

CREATE INDEX idx_store_brand_flags_store ON public.store_brand_flags(store_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_brand_flags TO authenticated;
GRANT ALL ON public.store_brand_flags TO service_role;

ALTER TABLE public.store_brand_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view store brand flags"
  ON public.store_brand_flags FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert store brand flags"
  ON public.store_brand_flags FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update store brand flags"
  ON public.store_brand_flags FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete store brand flags"
  ON public.store_brand_flags FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_store_brand_flags_updated_at
  BEFORE UPDATE ON public.store_brand_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();