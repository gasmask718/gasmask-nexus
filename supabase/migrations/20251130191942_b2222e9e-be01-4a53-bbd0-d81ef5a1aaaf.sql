-- Add role_name column to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS role_name text REFERENCES public.roles(name) ON DELETE SET NULL;

-- Populate role_name from existing role column
UPDATE public.user_roles 
SET role_name = role::text 
WHERE role_name IS NULL;