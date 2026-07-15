-- Reset dedup staging tables (were built on old 252 list; wrong)
DROP TABLE IF EXISTS public._dedup_pairs CASCADE;
DROP TABLE IF EXISTS public._dedup_merge CASCADE;
DROP TABLE IF EXISTS public._dedup_pairs_d3d00001 CASCADE;
DROP TABLE IF EXISTS public._dedup_snap_d3d00001 CASCADE;
DROP TABLE IF EXISTS public._dedup_snap_notes_d3d00001 CASCADE;
DROP TABLE IF EXISTS public._dedup_snap_invoices_d3d00001 CASCADE;

CREATE TABLE public._dedup_pairs (
  delete_store_id uuid NOT NULL,
  name text,
  address text,
  zip text,
  survivor_store_id uuid NOT NULL,
  survivor_name text
);
GRANT ALL ON public._dedup_pairs TO service_role;
ALTER TABLE public._dedup_pairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service only" ON public._dedup_pairs FOR ALL USING (false);

CREATE TABLE public._dedup_merge (
  survivor_store_id uuid NOT NULL,
  survivor_name text,
  survivor_current_phone text,
  extra_phones text,
  action text
);
GRANT ALL ON public._dedup_merge TO service_role;
ALTER TABLE public._dedup_merge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service only" ON public._dedup_merge FOR ALL USING (false);