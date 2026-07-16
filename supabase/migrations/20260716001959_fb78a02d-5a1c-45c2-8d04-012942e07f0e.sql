CREATE TABLE public._cfin_pairs (
  delete_id uuid PRIMARY KEY,
  delete_name text,
  survivor_id uuid NOT NULL,
  survivor_name text,
  loaded_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public._cfin_pairs TO service_role;
ALTER TABLE public._cfin_pairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON public._cfin_pairs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public._cfin_cleanup (
  delete_id uuid PRIMARY KEY,
  delete_name text,
  loaded_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public._cfin_cleanup TO service_role;
ALTER TABLE public._cfin_cleanup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON public._cfin_cleanup FOR ALL TO service_role USING (true) WITH CHECK (true);