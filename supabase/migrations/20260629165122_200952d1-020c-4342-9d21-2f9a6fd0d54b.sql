CREATE TABLE IF NOT EXISTS public.store_saved_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products_all(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_saved_products TO authenticated;
GRANT ALL ON public.store_saved_products TO service_role;

ALTER TABLE public.store_saved_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own saved"
  ON public.store_saved_products
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());