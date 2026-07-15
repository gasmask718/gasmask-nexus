-- Pairs table (delete_id -> survivor_id) drives all downstream steps
CREATE TABLE IF NOT EXISTS public._dedup_pairs_d3d00001 (
  delete_store_id uuid PRIMARY KEY,
  survivor_store_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public._dedup_pairs_d3d00001 TO service_role;
ALTER TABLE public._dedup_pairs_d3d00001 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON public._dedup_pairs_d3d00001 TO service_role USING (true) WITH CHECK (true);

INSERT INTO public._dedup_pairs_d3d00001(delete_store_id, survivor_store_id) VALUES
('91bfebf4-70bd-4be1-aa17-e75852af8f56'::uuid,'43d01a84-62be-4f39-ad1b-d21d6a47ba95'::uuid),
('72b8a0c0-b0c1-4b27-905a-e1a59c6a1a1f'::uuid,'f887043c-08ca-4114-b8ec-afb76fb5b8df'::uuid)
ON CONFLICT DO NOTHING;

-- Load the remaining 250 pairs from the sandbox — done via a separate seed step below
-- Full store row snapshot for the 252 delete-targets
CREATE TABLE IF NOT EXISTS public._dedup_snap_d3d00001 AS
SELECT s.*, NULL::uuid AS survivor_store_id, now() AS snapped_at
FROM public.stores s WHERE false;
GRANT ALL ON public._dedup_snap_d3d00001 TO service_role;
ALTER TABLE public._dedup_snap_d3d00001 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON public._dedup_snap_d3d00001 TO service_role USING (true) WITH CHECK (true);

-- Notes snapshot (preserves original store_id for exact rollback)
CREATE TABLE IF NOT EXISTS public._dedup_snap_notes_d3d00001 AS
SELECT n.*, now() AS snapped_at FROM public.store_notes n WHERE false;
GRANT ALL ON public._dedup_snap_notes_d3d00001 TO service_role;
ALTER TABLE public._dedup_snap_notes_d3d00001 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON public._dedup_snap_notes_d3d00001 TO service_role USING (true) WITH CHECK (true);

-- Invoices snapshot (only affected rows)
CREATE TABLE IF NOT EXISTS public._dedup_snap_invoices_d3d00001 AS
SELECT i.*, now() AS snapped_at FROM public.invoices i WHERE false;
GRANT ALL ON public._dedup_snap_invoices_d3d00001 TO service_role;
ALTER TABLE public._dedup_snap_invoices_d3d00001 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON public._dedup_snap_invoices_d3d00001 TO service_role USING (true) WITH CHECK (true);