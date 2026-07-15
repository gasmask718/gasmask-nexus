
-- Plan tables (source of truth for enrichment values, loaded from user CSVs)
CREATE TABLE IF NOT EXISTS public._phase_plan_scalars (
  id bigserial PRIMARY KEY,
  store_id uuid NOT NULL,
  store_name text,
  field text NOT NULL,
  current_value text,
  v7_value text
);
CREATE INDEX IF NOT EXISTS ix_phase_plan_scalars_store ON public._phase_plan_scalars(store_id);

CREATE TABLE IF NOT EXISTS public._phase_plan_notes (
  id bigserial PRIMARY KEY,
  store_id uuid NOT NULL,
  note text NOT NULL,
  note_date text,
  date_status text,
  source text
);
CREATE INDEX IF NOT EXISTS ix_phase_plan_notes_store ON public._phase_plan_notes(store_id);

CREATE TABLE IF NOT EXISTS public._phase_plan_invoices (
  id bigserial PRIMARY KEY,
  store_id uuid NOT NULL,
  store_name text,
  owed numeric,
  paid numeric,
  order_hist text,
  status text,
  source text
);
CREATE INDEX IF NOT EXISTS ix_phase_plan_invoices_store ON public._phase_plan_invoices(store_id);

CREATE TABLE IF NOT EXISTS public._phase_plan_conflicts (
  id bigserial PRIMARY KEY,
  store_id uuid NOT NULL,
  store_name text,
  field text NOT NULL,
  current_value text,
  v7_value text
);
CREATE INDEX IF NOT EXISTS ix_phase_plan_conflicts_store ON public._phase_plan_conflicts(store_id);

-- Stage tables (dry-run write target, mirror of prod shape with run_id tag)
CREATE TABLE IF NOT EXISTS public._stage_store_master (LIKE public.store_master INCLUDING DEFAULTS);
ALTER TABLE public._stage_store_master ADD COLUMN IF NOT EXISTS run_id uuid NOT NULL;
CREATE INDEX IF NOT EXISTS ix_stage_store_master_run ON public._stage_store_master(run_id);

CREATE TABLE IF NOT EXISTS public._stage_store_notes (LIKE public.store_notes INCLUDING DEFAULTS);
ALTER TABLE public._stage_store_notes ADD COLUMN IF NOT EXISTS run_id uuid NOT NULL;
CREATE INDEX IF NOT EXISTS ix_stage_store_notes_run ON public._stage_store_notes(run_id);

CREATE TABLE IF NOT EXISTS public._stage_invoices (LIKE public.invoices INCLUDING DEFAULTS);
ALTER TABLE public._stage_invoices ADD COLUMN IF NOT EXISTS run_id uuid NOT NULL;
CREATE INDEX IF NOT EXISTS ix_stage_invoices_run ON public._stage_invoices(run_id);

-- Grants + RLS (admin-only, consistent with _snap_/_phase_ pattern)
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    '_phase_plan_scalars','_phase_plan_notes','_phase_plan_invoices','_phase_plan_conflicts',
    '_stage_store_master','_stage_store_notes','_stage_invoices'
  ]) LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS admin_all ON public.%I', t);
    EXECUTE format('CREATE POLICY admin_all ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(),''admin''::app_role)) WITH CHECK (public.has_role(auth.uid(),''admin''::app_role))', t);
  END LOOP;
  -- grant seq usage for bigserial
  FOR t IN SELECT unnest(ARRAY[
    '_phase_plan_scalars_id_seq','_phase_plan_notes_id_seq','_phase_plan_invoices_id_seq','_phase_plan_conflicts_id_seq'
  ]) LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON SEQUENCE public.%I TO service_role', t);
  END LOOP;
END $$;
