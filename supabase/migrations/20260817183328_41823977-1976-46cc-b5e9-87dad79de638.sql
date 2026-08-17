DROP INDEX IF EXISTS public.event_halls_ut_listing_id_key;
DROP INDEX IF EXISTS public.event_halls_ut_listing_id_uidx;
DROP INDEX IF EXISTS public.rental_partners_ut_listing_id_key;
DROP INDEX IF EXISTS public.rental_partners_ut_listing_id_uidx;
DROP INDEX IF EXISTS public.staff_members_ut_ut_listing_id_key;
DROP INDEX IF EXISTS public.staff_members_ut_ut_listing_id_uidx;
DROP INDEX IF EXISTS public.unforgettable_ambassadors_ut_listing_id_key;
DROP INDEX IF EXISTS public.unforgettable_ambassadors_ut_listing_id_uidx;

CREATE UNIQUE INDEX event_halls_ut_listing_id_uidx ON public.event_halls (ut_listing_id);
CREATE UNIQUE INDEX rental_partners_ut_listing_id_uidx ON public.rental_partners (ut_listing_id);
CREATE UNIQUE INDEX staff_members_ut_ut_listing_id_uidx ON public.staff_members_ut (ut_listing_id);
CREATE UNIQUE INDEX unforgettable_ambassadors_ut_listing_id_uidx ON public.unforgettable_ambassadors (ut_listing_id);