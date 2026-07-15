
CREATE TABLE IF NOT EXISTS public._jobA_plan_manifest (
  prod_store_id uuid PRIMARY KEY,
  v7_key text,
  store_name text,
  google_address text
);
GRANT ALL ON public._jobA_plan_manifest TO service_role;
ALTER TABLE public._jobA_plan_manifest ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public._jobA_plan_scalar (
  id bigserial PRIMARY KEY,
  store_id uuid, field text, current text, v7_value text
);
GRANT ALL ON public._jobA_plan_scalar TO service_role;
ALTER TABLE public._jobA_plan_scalar ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public._jobA_plan_notes (
  id bigserial PRIMARY KEY,
  store_id uuid, note text, note_date text, source text
);
GRANT ALL ON public._jobA_plan_notes TO service_role;
ALTER TABLE public._jobA_plan_notes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public._jobA_plan_invoices (
  id bigserial PRIMARY KEY,
  store_id uuid, invoice_date text, amount numeric, description text, source text
);
GRANT ALL ON public._jobA_plan_invoices TO service_role;
ALTER TABLE public._jobA_plan_invoices ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public._jobA_plan_conflicts (
  id bigserial PRIMARY KEY,
  store_id uuid, field text, current text, v7_value text
);
GRANT ALL ON public._jobA_plan_conflicts TO service_role;
ALTER TABLE public._jobA_plan_conflicts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public._jobA_snap_stores (
  run_id uuid NOT NULL,
  store_id uuid NOT NULL,
  snap jsonb NOT NULL,
  snapped_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, store_id)
);
GRANT ALL ON public._jobA_snap_stores TO service_role;
ALTER TABLE public._jobA_snap_stores ENABLE ROW LEVEL SECURITY;
