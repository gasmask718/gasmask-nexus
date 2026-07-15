
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS last_update_run_id uuid;

CREATE TABLE IF NOT EXISTS public._mfix_stage_d4ef96f9 (
  store_id uuid PRIMARY KEY,
  address_street text,
  city text,
  zip text,
  neighborhood text,
  phone text
);
GRANT ALL ON public._mfix_stage_d4ef96f9 TO service_role;
ALTER TABLE public._mfix_stage_d4ef96f9 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON public._mfix_stage_d4ef96f9 FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public._mfix_snap_d4ef96f9 (
  id uuid PRIMARY KEY,
  address_street text,
  address_city text,
  address_zip text,
  neighborhood text,
  phone text,
  snapshotted_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public._mfix_snap_d4ef96f9 TO service_role;
ALTER TABLE public._mfix_snap_d4ef96f9 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON public._mfix_snap_d4ef96f9 FOR ALL TO service_role USING (true) WITH CHECK (true);
