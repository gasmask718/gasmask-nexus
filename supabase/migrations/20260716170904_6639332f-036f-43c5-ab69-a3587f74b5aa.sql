
CREATE TABLE public.store_inventory_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL,
  phone text,
  inventory_status text NOT NULL DEFAULT 'pending',
  notes text,
  last_called timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_inventory_leads TO authenticated;
GRANT ALL ON public.store_inventory_leads TO service_role;

ALTER TABLE public.store_inventory_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ops staff can read inventory leads"
  ON public.store_inventory_leads FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'va')
  );

CREATE POLICY "Ops staff can insert inventory leads"
  ON public.store_inventory_leads FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'va')
  );

CREATE POLICY "Ops staff can update inventory leads"
  ON public.store_inventory_leads FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'va')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'va')
  );

CREATE POLICY "Admins can delete inventory leads"
  ON public.store_inventory_leads FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'owner')
  );

CREATE TRIGGER update_store_inventory_leads_updated_at
  BEFORE UPDATE ON public.store_inventory_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
