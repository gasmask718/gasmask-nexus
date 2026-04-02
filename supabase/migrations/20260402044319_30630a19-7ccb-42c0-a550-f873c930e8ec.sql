
-- funding_machine_settings table
CREATE TABLE IF NOT EXISTS public.funding_machine_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funding_machine_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage funding settings"
ON public.funding_machine_settings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Add portal columns to funding_clients
ALTER TABLE public.funding_clients
ADD COLUMN IF NOT EXISTS portal_invite_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS portal_user_id TEXT;
