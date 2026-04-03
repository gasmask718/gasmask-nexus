
-- Add missing columns
ALTER TABLE public.dc_phone_numbers
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS elevenlabs_agent_name text,
  ADD COLUMN IF NOT EXISTS twilio_webhook_configured boolean NOT NULL DEFAULT false;

-- Update all 19 numbers with display names and agent assignments
UPDATE public.dc_phone_numbers SET display_name = 'Brandaro Inbound', elevenlabs_agent_name = 'DC Sales Outreach', business = 'brandaro' WHERE phone_number = '+18887598857';
UPDATE public.dc_phone_numbers SET display_name = 'Brandaro Georgia', elevenlabs_agent_name = 'DC Sales Outreach', business = 'brandaro' WHERE phone_number = '+14048009371';
UPDATE public.dc_phone_numbers SET display_name = 'Brandaro New Jersey', elevenlabs_agent_name = 'DC Sales Outreach', business = 'brandaro' WHERE phone_number = '+18483588206';
UPDATE public.dc_phone_numbers SET display_name = 'Brandaro California', elevenlabs_agent_name = 'DC Follow-up', business = 'brandaro' WHERE phone_number = '+12132978049';
UPDATE public.dc_phone_numbers SET display_name = 'Brandaro California', elevenlabs_agent_name = 'DC Follow-up', business = 'brandaro' WHERE phone_number = '+12135834490';
UPDATE public.dc_phone_numbers SET display_name = 'Brandaro Florida', elevenlabs_agent_name = 'DC Follow-up', business = 'brandaro' WHERE phone_number = '+13055207414';
UPDATE public.dc_phone_numbers SET display_name = 'Brandaro New York', elevenlabs_agent_name = 'DC Reactivation', business = 'brandaro' WHERE phone_number = '+19292389353';
UPDATE public.dc_phone_numbers SET display_name = 'Brandaro New York', elevenlabs_agent_name = 'DC Reactivation', business = 'brandaro' WHERE phone_number = '+19296746727';
UPDATE public.dc_phone_numbers SET display_name = 'Brandaro New York', elevenlabs_agent_name = 'DC Reactivation', business = 'brandaro' WHERE phone_number = '+19296613201';
UPDATE public.dc_phone_numbers SET display_name = 'Brandaro New York', elevenlabs_agent_name = 'DC Reactivation', business = 'brandaro' WHERE phone_number = '+19295727822';
UPDATE public.dc_phone_numbers SET display_name = 'Brandaro New York', elevenlabs_agent_name = 'DC Reactivation', business = 'brandaro' WHERE phone_number = '+19296598565';
UPDATE public.dc_phone_numbers SET display_name = 'Playboxxx AI Line', elevenlabs_agent_name = 'DC Sales Outreach', business = 'playboxxx' WHERE phone_number = '+19292623850';
UPDATE public.dc_phone_numbers SET display_name = 'iClean AI Line', elevenlabs_agent_name = 'DC Sales Outreach', business = 'iclean' WHERE phone_number = '+18777304526';
UPDATE public.dc_phone_numbers SET display_name = 'Brandaro AI Line', elevenlabs_agent_name = 'DC Sales Outreach', business = 'brandaro' WHERE phone_number = '+18888636609';
UPDATE public.dc_phone_numbers SET display_name = 'Top Tier AI Line', elevenlabs_agent_name = 'DC Follow-up', business = 'top_tier' WHERE phone_number = '+18442800741';
UPDATE public.dc_phone_numbers SET display_name = 'Surplus Funds AI Line', elevenlabs_agent_name = 'DC Sales Outreach', business = 'surplus_funds' WHERE phone_number = '+18558003705';
UPDATE public.dc_phone_numbers SET display_name = 'Real Estate AI Line', elevenlabs_agent_name = 'DC Follow-up', business = 'real_estate' WHERE phone_number = '+19292983199';
UPDATE public.dc_phone_numbers SET display_name = 'Unforgettable Times AI Line', elevenlabs_agent_name = 'DC Sales Outreach', business = 'unforgettable_times' WHERE phone_number = '+19294990837';
UPDATE public.dc_phone_numbers SET display_name = 'GasMask Main Line', elevenlabs_agent_name = 'GasMask Inventory Check', business = 'gasmask' WHERE phone_number = '+18484004179';
