DROP TABLE IF EXISTS public._phase_plan_invoices;
DROP TABLE IF EXISTS public._phase_plan_invoices_final;
CREATE TABLE public._phase_plan_invoices_final (
  row_no BIGSERIAL PRIMARY KEY,
  store_id UUID NOT NULL,
  invoice_date TEXT,
  amount NUMERIC(14,2),
  description TEXT,
  source TEXT
);
CREATE INDEX ON public._phase_plan_invoices_final(store_id);
GRANT ALL ON public._phase_plan_invoices_final TO service_role;
GRANT ALL ON SEQUENCE public._phase_plan_invoices_final_row_no_seq TO service_role;
ALTER TABLE public._phase_plan_invoices_final ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no client access" ON public._phase_plan_invoices_final FOR ALL USING (false) WITH CHECK (false);