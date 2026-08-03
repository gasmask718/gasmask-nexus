CREATE TABLE public.invoice_reconstruction_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_label text NOT NULL,
  parser_version text NOT NULL,
  rows_scanned integer NOT NULL DEFAULT 0,
  rows_written integer NOT NULL DEFAULT 0,
  high_confidence_count integer NOT NULL DEFAULT 0,
  band_cleared_count integer NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  notes text,
  rollback_statement text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_reconstruction_runs TO authenticated;
GRANT ALL ON public.invoice_reconstruction_runs TO service_role;
ALTER TABLE public.invoice_reconstruction_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth can read recon runs" ON public.invoice_reconstruction_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth can manage recon runs" ON public.invoice_reconstruction_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.invoice_line_reconstruction_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.invoice_reconstruction_runs(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL,
  store_id uuid,
  business_date date,
  raw_note text NOT NULL,
  clause_text text,
  entry_index integer NOT NULL DEFAULT 0,
  product_id uuid,
  product_name text NOT NULL,
  unit_word text,
  quantity_units numeric NOT NULL,
  quantity_boxes numeric,
  quantity_tubes numeric,
  units_per_box integer NOT NULL DEFAULT 100,
  list_unit_price numeric NOT NULL,
  unit_price numeric NOT NULL,
  line_total numeric NOT NULL,
  invoice_total_amount numeric,
  reconcile_target numeric,
  implied_unit_price numeric,
  price_ratio_to_list numeric,
  price_basis text NOT NULL DEFAULT 'list',
  tier text NOT NULL,
  confidence_product numeric NOT NULL DEFAULT 0,
  confidence_quantity numeric NOT NULL DEFAULT 0,
  confidence_price numeric NOT NULL DEFAULT 0,
  confidence_overall numeric NOT NULL DEFAULT 0,
  line_source text NOT NULL DEFAULT 'parsed_from_note',
  amount_from_note boolean NOT NULL DEFAULT false,
  flags text[] NOT NULL DEFAULT '{}',
  committed_line_item_id uuid,
  committed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ilrs_run ON public.invoice_line_reconstruction_staging(run_id);
CREATE INDEX idx_ilrs_invoice ON public.invoice_line_reconstruction_staging(invoice_id);
CREATE INDEX idx_ilrs_tier ON public.invoice_line_reconstruction_staging(tier);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_line_reconstruction_staging TO authenticated;
GRANT ALL ON public.invoice_line_reconstruction_staging TO service_role;
ALTER TABLE public.invoice_line_reconstruction_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth can read recon staging" ON public.invoice_line_reconstruction_staging FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth can manage recon staging" ON public.invoice_line_reconstruction_staging FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_ilrs_updated_at BEFORE UPDATE ON public.invoice_line_reconstruction_staging
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_irr_updated_at BEFORE UPDATE ON public.invoice_reconstruction_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS revenue_role text NOT NULL DEFAULT 'sale',
  ADD COLUMN IF NOT EXISTS sale_never_imported boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referenced_external_number text;

CREATE INDEX IF NOT EXISTS idx_invoices_revenue_role ON public.invoices(revenue_role);
CREATE INDEX IF NOT EXISTS idx_invoices_sale_never_imported ON public.invoices(sale_never_imported) WHERE sale_never_imported;