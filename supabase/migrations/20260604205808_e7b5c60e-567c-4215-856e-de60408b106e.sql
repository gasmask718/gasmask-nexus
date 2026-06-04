CREATE TABLE IF NOT EXISTS public.field_collection_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  invoice_id uuid,
  amount numeric(12,2),
  method text NOT NULL DEFAULT 'cash',
  note text,
  collected_by uuid NOT NULL DEFAULT auth.uid(),
  collected_at timestamptz NOT NULL DEFAULT now(),
  reconciled boolean NOT NULL DEFAULT false,
  reconciled_by uuid,
  reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fcp_store ON public.field_collection_pings(store_id);
CREATE INDEX IF NOT EXISTS idx_fcp_reconciled ON public.field_collection_pings(reconciled) WHERE reconciled = false;
CREATE INDEX IF NOT EXISTS idx_fcp_collector ON public.field_collection_pings(collected_by);
GRANT SELECT, INSERT, UPDATE ON public.field_collection_pings TO authenticated;
GRANT ALL ON public.field_collection_pings TO service_role;
ALTER TABLE public.field_collection_pings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rep can insert own pings" ON public.field_collection_pings FOR INSERT TO authenticated WITH CHECK (collected_by = auth.uid());
CREATE POLICY "rep can read own pings" ON public.field_collection_pings FOR SELECT TO authenticated USING (collected_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "office can reconcile" ON public.field_collection_pings FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'accountant'::app_role));