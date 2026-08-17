ALTER TABLE public.staff_members_ut
  ADD COLUMN IF NOT EXISTS custom_role_description text,
  ADD COLUMN IF NOT EXISTS mirror_extra jsonb NOT NULL DEFAULT '{}'::jsonb;