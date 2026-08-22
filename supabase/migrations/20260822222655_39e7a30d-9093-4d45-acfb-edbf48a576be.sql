ALTER TABLE public.ambassador_purchases ADD COLUMN IF NOT EXISTS decline_reason text;

CREATE POLICY "Admin can update purchase items"
ON public.ambassador_purchase_items FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid()
    AND profiles.role::text = ANY (ARRAY['admin','owner','ceo','va'])
));