ALTER TABLE public.va_sessions
  DROP CONSTRAINT IF EXISTS va_sessions_twilio_number_id_fkey;

DELETE FROM public.brandaro_phone_numbers WHERE friendly_name ILIKE 'VA Line%';