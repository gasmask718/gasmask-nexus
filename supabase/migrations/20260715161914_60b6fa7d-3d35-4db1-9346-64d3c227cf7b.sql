
CREATE TABLE public._pass2_match_manifest (
  prod_store_id uuid PRIMARY KEY,
  store_name text,
  address text,
  v7_key text,
  tier text
);
GRANT ALL ON public._pass2_match_manifest TO service_role;
ALTER TABLE public._pass2_match_manifest ENABLE ROW LEVEL SECURITY;
CREATE POLICY "_pass2_match_manifest admin only" ON public._pass2_match_manifest
  FOR ALL USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TABLE public._pass2_plan_scalars (
  id bigserial PRIMARY KEY,
  store_id uuid NOT NULL,
  field text NOT NULL,
  current_value text,
  v7_value text
);
CREATE INDEX ix_pass2_plan_scalars_store ON public._pass2_plan_scalars(store_id);
GRANT ALL ON public._pass2_plan_scalars TO service_role;
GRANT USAGE, SELECT ON SEQUENCE _pass2_plan_scalars_id_seq TO service_role;
ALTER TABLE public._pass2_plan_scalars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON public._pass2_plan_scalars
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TABLE public._pass2_plan_notes (
  id bigserial PRIMARY KEY,
  store_id uuid NOT NULL,
  note text NOT NULL,
  note_date text,
  source text
);
CREATE INDEX ix_pass2_plan_notes_store ON public._pass2_plan_notes(store_id);
GRANT ALL ON public._pass2_plan_notes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE _pass2_plan_notes_id_seq TO service_role;
ALTER TABLE public._pass2_plan_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON public._pass2_plan_notes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TABLE public._pass2_plan_invoices_final (
  row_no bigserial PRIMARY KEY,
  store_id uuid NOT NULL,
  invoice_date text,
  amount numeric(14,2),
  description text,
  source text
);
CREATE INDEX ix_pass2_plan_invoices_store ON public._pass2_plan_invoices_final(store_id);
GRANT ALL ON public._pass2_plan_invoices_final TO service_role;
GRANT USAGE, SELECT ON SEQUENCE _pass2_plan_invoices_final_row_no_seq TO service_role;
ALTER TABLE public._pass2_plan_invoices_final ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no client access" ON public._pass2_plan_invoices_final
  FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE public._pass2_plan_conflicts (
  id bigserial PRIMARY KEY,
  store_id uuid NOT NULL,
  field text NOT NULL,
  current_value text,
  v7_value text
);
CREATE INDEX ix_pass2_plan_conflicts_store ON public._pass2_plan_conflicts(store_id);
GRANT ALL ON public._pass2_plan_conflicts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE _pass2_plan_conflicts_id_seq TO service_role;
ALTER TABLE public._pass2_plan_conflicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON public._pass2_plan_conflicts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

INSERT INTO public.enrichment_runs (run_id, status, note)
VALUES ('bb220002-0000-4000-8000-000000000002'::uuid, 'snapshot_pending',
        'v7 enrichment pass2 - 502 matched stores (231 enriched, 271 no-new-data)');
