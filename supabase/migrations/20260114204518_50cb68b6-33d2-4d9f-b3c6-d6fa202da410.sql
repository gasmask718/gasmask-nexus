-- Add new fields to wholesalers table for enhanced contact info
ALTER TABLE public.wholesalers
ADD COLUMN IF NOT EXISTS phone_secondary text,
ADD COLUMN IF NOT EXISTS phone_whatsapp text,
ADD COLUMN IF NOT EXISTS social_media text,
ADD COLUMN IF NOT EXISTS neighborhood text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS tags text;