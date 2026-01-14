-- Add new fields to ambassadors table
ALTER TABLE public.ambassadors
ADD COLUMN IF NOT EXISTS name text,
ADD COLUMN IF NOT EXISTS phone_primary text,
ADD COLUMN IF NOT EXISTS phone_secondary text,
ADD COLUMN IF NOT EXISTS phone_whatsapp text,
ADD COLUMN IF NOT EXISTS social_media text,
ADD COLUMN IF NOT EXISTS neighborhood text,
ADD COLUMN IF NOT EXISTS city text;

-- Drop the unique constraint on user_id to allow multiple ambassadors
ALTER TABLE public.ambassadors DROP CONSTRAINT IF EXISTS ambassadors_user_id_key;