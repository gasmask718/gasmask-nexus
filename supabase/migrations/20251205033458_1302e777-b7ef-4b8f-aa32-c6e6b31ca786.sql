-- Add new columns to store_master for Customer Memory Core
ALTER TABLE public.store_master
ADD COLUMN IF NOT EXISTS nickname text,
ADD COLUMN IF NOT EXISTS country_of_origin text,
ADD COLUMN IF NOT EXISTS languages text[],
ADD COLUMN IF NOT EXISTS communication_preference text,
ADD COLUMN IF NOT EXISTS personality_notes text,
ADD COLUMN IF NOT EXISTS has_expansion boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS new_store_addresses text[],
ADD COLUMN IF NOT EXISTS expected_open_dates text[],
ADD COLUMN IF NOT EXISTS expansion_notes text,
ADD COLUMN IF NOT EXISTS influence_level text,
ADD COLUMN IF NOT EXISTS loyalty_triggers text[],
ADD COLUMN IF NOT EXISTS frustration_triggers text[],
ADD COLUMN IF NOT EXISTS risk_score text DEFAULT 'low';

-- Add influence_level and notes to store_contacts
ALTER TABLE public.store_contacts
ADD COLUMN IF NOT EXISTS influence_level text,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS email text;