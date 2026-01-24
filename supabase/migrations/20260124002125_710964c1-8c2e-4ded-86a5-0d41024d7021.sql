-- Add is_callable column to user_profiles for telephony callability tracking
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS is_callable BOOLEAN NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.user_profiles.is_callable IS 'Whether this user can receive inbound calls. When false, routing will skip this user.';