
-- ============================================================
-- GASMASK ENRICHMENT — Step (a): infrastructure only
-- No data snapshots taken yet, no enrichment writes.
-- ============================================================

-- 1) Enrichment run registry
CREATE TABLE IF NOT EXISTS public.enrichment_runs (
  run_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  status     text NOT NULL DEFAULT 'snapshot_pending',
  note       text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrichment_runs TO authenticated;
GRANT ALL ON public.enrichment_runs TO service_role;
ALTER TABLE public.enrichment_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enrichment_runs admin only"
  ON public.enrichment_runs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Snapshot tables — mirror source structure, no PK/constraints/indexes to
-- allow multi-run coexistence. Tagged with run_id.
CREATE TABLE IF NOT EXISTS public._snap_store_master
  (LIKE public.store_master INCLUDING DEFAULTS);
ALTER TABLE public._snap_store_master ADD COLUMN IF NOT EXISTS run_id uuid NOT NULL;
CREATE INDEX IF NOT EXISTS idx_snap_store_master_run ON public._snap_store_master(run_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public._snap_store_master TO authenticated;
GRANT ALL ON public._snap_store_master TO service_role;
ALTER TABLE public._snap_store_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY "_snap_store_master admin only"
  ON public._snap_store_master FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public._snap_store_notes
  (LIKE public.store_notes INCLUDING DEFAULTS);
ALTER TABLE public._snap_store_notes ADD COLUMN IF NOT EXISTS run_id uuid NOT NULL;
CREATE INDEX IF NOT EXISTS idx_snap_store_notes_run ON public._snap_store_notes(run_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public._snap_store_notes TO authenticated;
GRANT ALL ON public._snap_store_notes TO service_role;
ALTER TABLE public._snap_store_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "_snap_store_notes admin only"
  ON public._snap_store_notes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public._snap_invoices
  (LIKE public.invoices INCLUDING DEFAULTS);
ALTER TABLE public._snap_invoices ADD COLUMN IF NOT EXISTS run_id uuid NOT NULL;
CREATE INDEX IF NOT EXISTS idx_snap_invoices_run ON public._snap_invoices(run_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public._snap_invoices TO authenticated;
GRANT ALL ON public._snap_invoices TO service_role;
ALTER TABLE public._snap_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "_snap_invoices admin only"
  ON public._snap_invoices FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Rollback tagging columns on production tables
ALTER TABLE public.invoices    ADD COLUMN IF NOT EXISTS enrichment_run_id uuid;
CREATE INDEX IF NOT EXISTS idx_invoices_enrichment_run ON public.invoices(enrichment_run_id)
  WHERE enrichment_run_id IS NOT NULL;

ALTER TABLE public.store_notes ADD COLUMN IF NOT EXISTS enrichment_run_id uuid;
CREATE INDEX IF NOT EXISTS idx_store_notes_enrichment_run ON public.store_notes(enrichment_run_id)
  WHERE enrichment_run_id IS NOT NULL;

-- 4) Match manifest table — external plan enters the environment here
CREATE TABLE IF NOT EXISTS public._phase_match_manifest (
  prod_store_id uuid PRIMARY KEY,
  store_name    text,
  address       text,
  v7_key        text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public._phase_match_manifest TO authenticated;
GRANT ALL ON public._phase_match_manifest TO service_role;
ALTER TABLE public._phase_match_manifest ENABLE ROW LEVEL SECURITY;
CREATE POLICY "_phase_match_manifest admin only"
  ON public._phase_match_manifest FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
