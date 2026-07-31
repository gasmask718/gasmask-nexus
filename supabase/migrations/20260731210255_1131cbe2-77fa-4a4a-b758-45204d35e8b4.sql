
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) DEFAULT 'c3d4e5f6-a7b8-9012-cdef-123456789012';

UPDATE public.invoices i SET business_id = m.business_id
FROM public.store_master m
WHERE i.business_id IS NULL AND i.store_id = m.id AND m.business_id IS NOT NULL;

UPDATE public.invoices SET business_id = CASE
  WHEN lower(coalesce(brand,'')) LIKE '%hotmama%' THEN 'b2c3d4e5-f6a7-8901-bcde-f12345678901'::uuid
  WHEN lower(coalesce(brand,'')) LIKE '%scalati%' OR lower(coalesce(brand,'')) LIKE '%scolatti%' THEN 'd4e5f6a7-b8c9-0123-def0-234567890123'::uuid
  ELSE 'c3d4e5f6-a7b8-9012-cdef-123456789012'::uuid END
WHERE business_id IS NULL;

ALTER TABLE public.invoices ALTER COLUMN business_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_business_id ON public.invoices(business_id);

ALTER TABLE public.deliveries ALTER COLUMN business_id SET DEFAULT 'c3d4e5f6-a7b8-9012-cdef-123456789012';
UPDATE public.deliveries SET business_id = 'c3d4e5f6-a7b8-9012-cdef-123456789012' WHERE business_id IS NULL;
ALTER TABLE public.deliveries ALTER COLUMN business_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deliveries_business_id ON public.deliveries(business_id);

DROP POLICY IF EXISTS "VA view invoices" ON public.invoices;
CREATE POLICY "VA view invoices" ON public.invoices FOR SELECT TO authenticated
USING (has_business_role(auth.uid(),'va',business_id));

DROP POLICY IF EXISTS "VA view deliveries" ON public.deliveries;
CREATE POLICY "VA view deliveries" ON public.deliveries FOR SELECT TO authenticated
USING (has_business_role(auth.uid(),'va',business_id));
