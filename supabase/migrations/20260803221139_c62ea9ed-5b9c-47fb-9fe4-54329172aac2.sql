CREATE TABLE IF NOT EXISTS public.invoice_line_sku_reassignment_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  staging_id uuid NOT NULL,
  committed_line_item_id uuid,
  invoice_id uuid,
  previous_product_id uuid,
  previous_product_name text,
  previous_unit_price numeric,
  previous_list_unit_price numeric,
  previous_price_ratio numeric,
  new_product_id uuid NOT NULL,
  new_product_name text NOT NULL,
  new_list_unit_price numeric,
  new_price_ratio numeric,
  evidence text,
  raw_note text,
  applied_at timestamptz,
  reverted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.invoice_line_sku_reassignment_log TO authenticated;
GRANT ALL ON public.invoice_line_sku_reassignment_log TO service_role;

ALTER TABLE public.invoice_line_sku_reassignment_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read sku reassignment log"
ON public.invoice_line_sku_reassignment_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_ilsrl_run ON public.invoice_line_sku_reassignment_log(run_id);