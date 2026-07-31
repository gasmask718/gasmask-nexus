UPDATE public.dc_phone_numbers
SET is_active = false,
    friendly_name = 'QUARANTINED Playboxxx line (moved to isolated Twilio subaccount 2026-07-31 — do not re-wire)'
WHERE phone_number = '+19292623850';