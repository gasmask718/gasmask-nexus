-- Helper: does the signed-in user own this Brandaro lead as its assigned VA?
CREATE OR REPLACE FUNCTION public.va_owns_brandaro_lead(_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.brandaro_qualified_leads l
    WHERE l.id = _lead_id
      AND l.assigned_va = auth.uid()
  )
$$;

GRANT EXECUTE ON FUNCTION public.va_owns_brandaro_lead(uuid) TO authenticated;

-- ── brandaro_pending_messages: VA read + draft-only insert ──────────────
GRANT SELECT, INSERT ON public.brandaro_pending_messages TO authenticated;
GRANT ALL ON public.brandaro_pending_messages TO service_role;

DROP POLICY IF EXISTS "VA reads messages for own leads" ON public.brandaro_pending_messages;
CREATE POLICY "VA reads messages for own leads"
  ON public.brandaro_pending_messages
  FOR SELECT
  TO authenticated
  USING (lead_id IS NOT NULL AND public.va_owns_brandaro_lead(lead_id));

DROP POLICY IF EXISTS "VA drafts messages for own leads" ON public.brandaro_pending_messages;
CREATE POLICY "VA drafts messages for own leads"
  ON public.brandaro_pending_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    lead_id IS NOT NULL
    AND public.va_owns_brandaro_lead(lead_id)
    AND status = 'pending'
    AND sent_at IS NULL
    AND approved_at IS NULL
  );

-- ── brandaro_inbound_messages: close the all-authenticated read leak ────
GRANT SELECT ON public.brandaro_inbound_messages TO authenticated;
GRANT ALL ON public.brandaro_inbound_messages TO service_role;

DROP POLICY IF EXISTS "Authenticated users can manage inbound messages" ON public.brandaro_inbound_messages;

DROP POLICY IF EXISTS "Admins manage inbound messages" ON public.brandaro_inbound_messages;
CREATE POLICY "Admins manage inbound messages"
  ON public.brandaro_inbound_messages
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

DROP POLICY IF EXISTS "VA reads inbound for own leads" ON public.brandaro_inbound_messages;
CREATE POLICY "VA reads inbound for own leads"
  ON public.brandaro_inbound_messages
  FOR SELECT
  TO authenticated
  USING (lead_id IS NOT NULL AND public.va_owns_brandaro_lead(lead_id));