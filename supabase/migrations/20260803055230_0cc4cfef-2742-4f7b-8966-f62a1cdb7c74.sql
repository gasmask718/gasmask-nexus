ALTER TABLE public.brandaro_subscriptions
  DROP CONSTRAINT IF EXISTS brandaro_subscriptions_service_type_check;

ALTER TABLE public.brandaro_subscriptions
  ADD CONSTRAINT brandaro_subscriptions_service_type_check
  CHECK (service_type = ANY (ARRAY[
    'hosting'::text,
    'maintenance'::text,
    'seo'::text,
    'social_media'::text,
    'google_business'::text,
    'lead_gen'::text,
    'custom'::text
  ]));