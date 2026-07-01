
-- Relax RLS on dc_voicemail_templates to match existing DC admin pattern
-- (dc_agents/dc_businesses allow authenticated writes).
GRANT SELECT, INSERT, UPDATE ON public.dc_voicemail_templates TO authenticated;

-- Replace SELECT policy: authenticated sees ALL templates (active + inactive)
-- so admins can list/deactivate/reactivate. Previous policy hid inactive rows.
DROP POLICY IF EXISTS "authenticated can read active voicemail templates" ON public.dc_voicemail_templates;
DROP POLICY IF EXISTS "authenticated can read voicemail templates" ON public.dc_voicemail_templates;
CREATE POLICY "authenticated can read voicemail templates"
  ON public.dc_voicemail_templates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated can insert voicemail templates"
  ON public.dc_voicemail_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated can update voicemail templates"
  ON public.dc_voicemail_templates
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add matching column to ai_call_campaigns so the DCCampaignBuilder selector
-- can persist the choice on the campaign row it creates.
ALTER TABLE public.ai_call_campaigns
  ADD COLUMN IF NOT EXISTS voicemail_drop_template_id uuid
    REFERENCES public.dc_voicemail_templates(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.ai_call_campaigns.voicemail_drop_template_id IS
  'Optional dc_voicemail_templates.id chosen in Campaign Builder. Consumed by hub triggers via body.voicemail_drop_template_id.';
