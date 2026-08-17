ALTER TABLE public.event_halls ADD COLUMN IF NOT EXISTS mirror_extra jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.rental_partners ADD COLUMN IF NOT EXISTS mirror_extra jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.unforgettable_ambassadors ADD COLUMN IF NOT EXISTS mirror_extra jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.unforgettable_ambassadors ADD COLUMN IF NOT EXISTS city text;

COMMENT ON COLUMN public.event_halls.mirror_extra IS 'Unrecognised fields received from the UT venue mirror. Populated by receive-ut-venue; a non-empty value is a schema gap to promote, not a normal state.';
COMMENT ON COLUMN public.rental_partners.mirror_extra IS 'Unrecognised fields received from the UT rental mirror. Populated by receive-ut-rental.';
COMMENT ON COLUMN public.unforgettable_ambassadors.mirror_extra IS 'Unrecognised fields received from the UT ambassador mirror. Populated by receive-ut-ambassador.';
COMMENT ON COLUMN public.unforgettable_ambassadors.city IS 'Signup city from the UT ambassador payload. Was being discarded before 2026-08-17.';
COMMENT ON COLUMN public.event_halls.latitude IS 'Geocoded venue latitude from the UT payload. Nullable on purpose — an unresolved geocode must stay NULL, never 0.';
COMMENT ON COLUMN public.event_halls.longitude IS 'Geocoded venue longitude from the UT payload. Nullable on purpose — an unresolved geocode must stay NULL, never 0.';