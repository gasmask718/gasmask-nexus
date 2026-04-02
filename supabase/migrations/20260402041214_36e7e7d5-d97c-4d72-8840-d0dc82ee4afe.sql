ALTER TABLE public.funding_tradeline_vault_cards
ADD COLUMN IF NOT EXISTS cardholder_name TEXT,
ADD COLUMN IF NOT EXISTS cardholder_contact TEXT,
ADD COLUMN IF NOT EXISTS occupied_slots INTEGER DEFAULT 0;