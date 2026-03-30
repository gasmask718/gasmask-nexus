
ALTER TABLE public.brandaro_leads_master ADD COLUMN IF NOT EXISTS pipeline text NOT NULL DEFAULT 'english';

-- Backfill existing leads based on language
UPDATE public.brandaro_leads_master SET pipeline = 'spanish' WHERE language = 'spanish';
UPDATE public.brandaro_leads_master SET pipeline = 'english' WHERE language = 'english' OR language IS NULL;
