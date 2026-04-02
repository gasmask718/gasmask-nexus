ALTER TABLE public.dc_phone_numbers 
ADD COLUMN IF NOT EXISTS business TEXT DEFAULT 'unassigned',
ADD COLUMN IF NOT EXISTS assigned_agent_name TEXT,
ADD COLUMN IF NOT EXISTS monthly_cost DECIMAL DEFAULT 1.00;

ALTER TABLE public.dc_phone_numbers
DROP CONSTRAINT IF EXISTS dc_phone_numbers_phone_number_key;

ALTER TABLE public.dc_phone_numbers
ADD CONSTRAINT dc_phone_numbers_phone_number_key 
UNIQUE (phone_number);