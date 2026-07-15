DROP TABLE IF EXISTS public._overlap_pairs;
CREATE TABLE public._overlap_pairs (
  lead_store_id uuid,
  name text,
  address text,
  existing_customer_id uuid,
  action text,
  loaded_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public._overlap_pairs TO service_role;
ALTER TABLE public._overlap_pairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON public._overlap_pairs TO service_role USING (true) WITH CHECK (true);