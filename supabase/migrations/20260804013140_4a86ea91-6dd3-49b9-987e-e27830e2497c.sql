CREATE TABLE IF NOT EXISTS public.business_owner_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  contact_type text NOT NULL DEFAULT 'owner',
  display_name text,
  phone_e164 text NOT NULL,
  ring_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_owner_contacts_phone_e164_chk CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  CONSTRAINT business_owner_contacts_unique UNIQUE (business_id, phone_e164)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_owner_contacts TO authenticated;
GRANT ALL ON public.business_owner_contacts TO service_role;

ALTER TABLE public.business_owner_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage business owner contacts"
  ON public.business_owner_contacts
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_business_owner_contacts_updated_at
  BEFORE UPDATE ON public.business_owner_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS business_owner_contacts_biz_idx
  ON public.business_owner_contacts (business_id, is_active, ring_order);

ALTER TABLE public.human_agent_line_status
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS client_identity text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS on_shift_since timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS human_agent_line_status_client_identity_key
  ON public.human_agent_line_status (client_identity)
  WHERE client_identity IS NOT NULL;

CREATE INDEX IF NOT EXISTS human_agent_line_status_biz_status_idx
  ON public.human_agent_line_status (business_id, status);