CREATE TABLE public.dc_lead_store_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  lead_id uuid NOT NULL,
  business_unit_key text,
  store_id uuid NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.store_contacts(id) ON DELETE SET NULL,
  business_id uuid,
  matched_by text NOT NULL CHECK (matched_by IN ('phone_last10','address','name_city_state','created')),
  match_status text NOT NULL CHECK (match_status IN ('linked','created')),
  match_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX dc_lead_store_links_lead_unique
  ON public.dc_lead_store_links (source_table, lead_id);
CREATE INDEX dc_lead_store_links_store_idx ON public.dc_lead_store_links (store_id);

GRANT SELECT ON public.dc_lead_store_links TO authenticated;
GRANT ALL ON public.dc_lead_store_links TO service_role;

ALTER TABLE public.dc_lead_store_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view DC lead links"
  ON public.dc_lead_store_links FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
    OR public.has_role(auth.uid(), 'employee'::app_role)
    OR public.has_role(auth.uid(), 'va'::app_role)
  );

CREATE TRIGGER dc_lead_store_links_updated_at
  BEFORE UPDATE ON public.dc_lead_store_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();