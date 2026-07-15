DROP TABLE IF EXISTS public._overlap_safe;
CREATE TABLE public._overlap_safe (
  lead_store_id uuid,
  existing_customer_id uuid,
  lead_name text,
  cust_name text,
  loaded_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public._overlap_safe TO service_role;
ALTER TABLE public._overlap_safe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON public._overlap_safe TO service_role USING (true) WITH CHECK (true);