
-- Add status column that the external site expects
ALTER TABLE public.solar_partner_deals
ADD COLUMN IF NOT EXISTS status text GENERATED ALWAYS AS (deal_status) STORED;

-- Create index for status lookups
CREATE INDEX IF NOT EXISTS idx_solar_partner_deals_status ON public.solar_partner_deals(status);
