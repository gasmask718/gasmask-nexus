DROP POLICY IF EXISTS "Partner sees own dispatches" ON public.tt_dispatch_requests;

CREATE POLICY "Partner sees own dispatches"
ON public.tt_dispatch_requests
FOR SELECT
TO authenticated
USING (
  (
    accepted_partner_id IS NOT NULL
    AND accepted_partner_id IN (
      SELECT id::text FROM public.tt_partners WHERE user_id = auth.uid()
    )
  )
  OR
  (
    status = 'sent'
    AND accepted_partner_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(matched_partners, '[]'::jsonb)) AS mp
      WHERE (mp->>'id') IN (
        SELECT id::text FROM public.tt_partners WHERE user_id = auth.uid()
      )
    )
  )
);