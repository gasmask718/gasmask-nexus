
UPDATE public.communication_logs c
SET business_id = m.business_id
FROM public.store_master m
WHERE c.business_id IS NULL AND c.store_id = m.id AND m.business_id IS NOT NULL;

UPDATE public.communication_logs SET business_id = CASE lower(brand)
  WHEN 'tte' THEN 'ae4cd082-c0f8-4d36-8bed-f6d744daf507'::uuid
  WHEN 'toptier' THEN 'ae4cd082-c0f8-4d36-8bed-f6d744daf507'::uuid
  WHEN 'iclean' THEN '85fb8f0b-a5c7-420c-841c-f92e80fa9b66'::uuid
  WHEN 'playboxxx' THEN 'ea6c5ef9-90d4-4a63-bb2b-7720a341ebdc'::uuid
  WHEN 'funding' THEN 'e54443eb-5004-4e23-a468-475d12442846'::uuid
  ELSE 'b2614d31-87fa-4f20-994f-c12b3e0b9c41'::uuid END
WHERE business_id IS NULL AND brand IS NOT NULL;

UPDATE public.communication_logs SET business_id = 'c3d4e5f6-a7b8-9012-cdef-123456789012'
WHERE business_id IS NULL;

ALTER TABLE public.communication_logs ALTER COLUMN business_id SET DEFAULT 'c3d4e5f6-a7b8-9012-cdef-123456789012';
ALTER TABLE public.communication_logs ALTER COLUMN business_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_communication_logs_business_id ON public.communication_logs(business_id);

DROP POLICY IF EXISTS va_select_communication_logs ON public.communication_logs;
DROP POLICY IF EXISTS va_insert_communication_logs ON public.communication_logs;
DROP POLICY IF EXISTS va_update_communication_logs ON public.communication_logs;
CREATE POLICY va_select_communication_logs ON public.communication_logs FOR SELECT TO authenticated
USING (has_business_role(auth.uid(),'va',business_id));
CREATE POLICY va_insert_communication_logs ON public.communication_logs FOR INSERT TO authenticated
WITH CHECK (has_business_role(auth.uid(),'va',business_id) AND ((created_by IS NULL) OR (created_by = auth.uid())));
CREATE POLICY va_update_communication_logs ON public.communication_logs FOR UPDATE TO authenticated
USING (has_business_role(auth.uid(),'va',business_id))
WITH CHECK (has_business_role(auth.uid(),'va',business_id));
