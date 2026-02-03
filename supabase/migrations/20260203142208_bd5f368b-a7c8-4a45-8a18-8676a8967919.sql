
-- Add production to app_role enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'production' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE app_role ADD VALUE 'production';
  END IF;
END$$;

-- Add assigned_brand_id and assigned_store_id to user_invitations if not exists
ALTER TABLE public.user_invitations 
ADD COLUMN IF NOT EXISTS assigned_brand_id TEXT,
ADD COLUMN IF NOT EXISTS assigned_store_id UUID REFERENCES public.store_master(id);

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON public.user_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON public.user_invitations(email);

-- RLS policies for user_invitations
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Anyone can validate invite token" ON public.user_invitations;

-- Admins/owners can manage invitations
CREATE POLICY "Admins can manage invitations" ON public.user_invitations
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'admin')
  )
);

-- Anyone can SELECT to validate an invite token (needed for signup flow)
CREATE POLICY "Anyone can validate invite token" ON public.user_invitations
FOR SELECT TO anon, authenticated
USING (true);
