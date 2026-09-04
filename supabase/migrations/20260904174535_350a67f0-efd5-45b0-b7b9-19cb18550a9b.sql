ALTER TABLE public.store_contacts ADD COLUMN IF NOT EXISTS gift_request text;

CREATE TABLE IF NOT EXISTS public.store_sample_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  product_id uuid,
  brand text,
  qty_remaining integer NOT NULL CHECK (qty_remaining >= 0),
  note text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  checked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_sample_checks_store ON public.store_sample_checks (store_id, checked_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_sample_checks TO authenticated;
GRANT ALL ON public.store_sample_checks TO service_role;

ALTER TABLE public.store_sample_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view sample checks"
ON public.store_sample_checks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can record sample checks"
ON public.store_sample_checks FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Recorder or admin can update sample checks"
ON public.store_sample_checks FOR UPDATE TO authenticated
USING (checked_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
WITH CHECK (checked_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Recorder or admin can delete sample checks"
ON public.store_sample_checks FOR DELETE TO authenticated
USING (checked_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_store_sample_checks_updated_at
BEFORE UPDATE ON public.store_sample_checks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();