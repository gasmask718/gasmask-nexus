INSERT INTO public.dc_phone_numbers (phone_number, friendly_name, display_name, business, number_type, is_active, is_ai_number, status)
VALUES ('+19298225712', 'Main Voice Line', 'Main Voice Line', 'gasmask', 'local', true, false, 'active')
ON CONFLICT DO NOTHING;

UPDATE public.dc_phone_numbers
SET is_active = true, friendly_name = COALESCE(friendly_name, 'Main Voice Line'), display_name = COALESCE(display_name, 'Main Voice Line')
WHERE phone_number = '+19298225712';

UPDATE public.dc_phone_numbers
SET is_active = false, deactivated_at = COALESCE(deactivated_at, now()), deactivation_reason = COALESCE(deactivation_reason, 'Replaced by +19298225712 as main voice line')
WHERE phone_number = '+19292623850';