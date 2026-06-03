
UPDATE public.products_all
   SET status = 'deleted',
       updated_at = now()
 WHERE id IN (
   'f371e8a8-678e-4aad-9caa-722c9a8e3f0c',
   '01039da3-82ae-4dd2-bec2-a37d2250ab08',
   'dc152df2-811c-4e3c-b503-09a7a927d118',
   '2e0a1a38-1571-418a-a9b5-2f0dcc107f1d'
 );

CREATE TABLE IF NOT EXISTS public.dd_catalog_drafts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  product_name  text NOT NULL,
  supplier_id   uuid,
  cost          numeric,
  input_photos  jsonb NOT NULL DEFAULT '[]'::jsonb,
  candidates    jsonb NOT NULL DEFAULT '[]'::jsonb,
  enhanced      jsonb NOT NULL DEFAULT '[]'::jsonb,
  staged        jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected      jsonb NOT NULL DEFAULT '[]'::jsonb,
  copy          jsonb NOT NULL DEFAULT '{}'::jsonb,
  pricing       jsonb NOT NULL DEFAULT '{}'::jsonb,
  status        text NOT NULL DEFAULT 'draft',
  published_product_id uuid REFERENCES public.products_all(id) ON DELETE SET NULL,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_catalog_drafts TO authenticated;
GRANT ALL ON public.dd_catalog_drafts TO service_role;

ALTER TABLE public.dd_catalog_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all catalog drafts"
  ON public.dd_catalog_drafts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Creators see and edit their own drafts"
  ON public.dd_catalog_drafts FOR ALL
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_dd_catalog_drafts_status ON public.dd_catalog_drafts(status);
CREATE INDEX IF NOT EXISTS idx_dd_catalog_drafts_created_by ON public.dd_catalog_drafts(created_by);

CREATE TRIGGER trg_dd_catalog_drafts_updated_at
  BEFORE UPDATE ON public.dd_catalog_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
