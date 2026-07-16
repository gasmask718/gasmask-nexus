CREATE TABLE IF NOT EXISTS public._cust_pairs (
  delete_id uuid PRIMARY KEY,
  delete_name text,
  delete_phone text,
  survivor_id uuid NOT NULL,
  survivor_name text,
  address text,
  zip text,
  loaded_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public._cust_pairs TO service_role;
ALTER TABLE public._cust_pairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON public._cust_pairs FOR ALL TO service_role USING (true) WITH CHECK (true);