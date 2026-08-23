-- Dynasty Connect is the switchboard: its members may pick any company in the
-- portal, so a DC member must be able to register their mobile against the
-- company they are currently working, not only companies they directly hold.
DROP POLICY ring_va_insert_own_mobile ON public.inbound_ring_targets;
CREATE POLICY ring_va_insert_own_mobile ON public.inbound_ring_targets
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND target_type = 'mobile'
    AND EXISTS (
      SELECT 1
      FROM public.va_company_memberships m
      JOIN public.va_companies c ON c.id = m.company_id
      WHERE m.user_id = auth.uid()
        AND m.is_active = true
        AND (m.company_id = va_company_id OR c.slug = 'dynasty_connect')
    )
  );