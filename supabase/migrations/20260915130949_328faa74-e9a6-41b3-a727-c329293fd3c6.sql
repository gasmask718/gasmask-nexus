
ALTER TABLE public.products_all
  ADD COLUMN IF NOT EXISTS shipping_spec_status text,
  ADD COLUMN IF NOT EXISTS shipping_spec_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipping_spec_candidates jsonb,
  ADD COLUMN IF NOT EXISTS shipping_spec_locked boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE public.products_all
    ADD CONSTRAINT products_all_shipping_spec_status_chk
    CHECK (shipping_spec_status IS NULL OR shipping_spec_status IN
      ('confirmed','high_confidence','needs_review','not_found','sourcing','manual'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.dd_spec_sourcing_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products_all(id) ON DELETE CASCADE,
  identifier_key text,
  identifiers jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL,
  applied boolean NOT NULL DEFAULT false,
  candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  chosen jsonb,
  sources_tried jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  triggered_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dd_spec_sourcing_log_identifier_idx ON public.dd_spec_sourcing_log(identifier_key, created_at DESC);
CREATE INDEX IF NOT EXISTS dd_spec_sourcing_log_product_idx ON public.dd_spec_sourcing_log(product_id, created_at DESC);

GRANT SELECT ON public.dd_spec_sourcing_log TO authenticated;
GRANT ALL ON public.dd_spec_sourcing_log TO service_role;

ALTER TABLE public.dd_spec_sourcing_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read spec sourcing log" ON public.dd_spec_sourcing_log;
CREATE POLICY "admins read spec sourcing log" ON public.dd_spec_sourcing_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
