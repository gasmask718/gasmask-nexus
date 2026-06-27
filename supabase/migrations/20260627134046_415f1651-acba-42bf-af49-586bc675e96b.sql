-- Backfill sms_template_key on tt_service_routing + add default
UPDATE public.tt_service_routing SET sms_template_key = 'partner_dispatch'
WHERE sms_template_key IS NULL AND slug IN (
  'black-truck','sprinters','exotic-cars','party-bus','coach-bus',
  'helicopter','private-jet','yachts','jetski','slingshot',
  'hotel-decor','vehicle_decor_chauffeured','truck-decor'
);

UPDATE public.tt_service_routing SET sms_template_key = 'booking_confirmed_hotel'
WHERE sms_template_key IS NULL AND slug = 'hotels';

UPDATE public.tt_service_routing SET sms_template_key = 'booking_confirmed_club'
WHERE sms_template_key IS NULL AND slug = 'club';

UPDATE public.tt_service_routing SET sms_template_key = 'partner_quote_request'
WHERE sms_template_key IS NULL;

ALTER TABLE public.tt_service_routing ALTER COLUMN sms_template_key SET DEFAULT 'partner_dispatch';