ALTER TABLE public.event_halls
  ADD COLUMN IF NOT EXISTS ut_listing_id text,
  ADD COLUMN IF NOT EXISTS ut_entity_type text;
ALTER TABLE public.rental_partners
  ADD COLUMN IF NOT EXISTS ut_listing_id text,
  ADD COLUMN IF NOT EXISTS ut_entity_type text;
ALTER TABLE public.staff_members_ut
  ADD COLUMN IF NOT EXISTS ut_listing_id text,
  ADD COLUMN IF NOT EXISTS ut_entity_type text;
ALTER TABLE public.unforgettable_ambassadors
  ADD COLUMN IF NOT EXISTS ut_listing_id text,
  ADD COLUMN IF NOT EXISTS ut_entity_type text;

COMMENT ON COLUMN public.event_halls.ut_listing_id IS 'UT-side event_halls.id. Natural key for mirror upserts; nullable for pre-2026-08-17 rows.';
COMMENT ON COLUMN public.rental_partners.ut_listing_id IS 'UT-side rental_companies.id. Natural key for mirror upserts; nullable for pre-2026-08-17 rows.';
COMMENT ON COLUMN public.staff_members_ut.ut_listing_id IS 'UT-side staff_members.id. Natural key for mirror upserts; nullable for pre-2026-08-17 rows.';
COMMENT ON COLUMN public.unforgettable_ambassadors.ut_listing_id IS 'UT-side ambassadors.id. Natural key for mirror upserts; nullable for pre-2026-08-17 rows.';

CREATE UNIQUE INDEX IF NOT EXISTS event_halls_ut_listing_id_key
  ON public.event_halls (ut_listing_id) WHERE ut_listing_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS rental_partners_ut_listing_id_key
  ON public.rental_partners (ut_listing_id) WHERE ut_listing_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS staff_members_ut_ut_listing_id_key
  ON public.staff_members_ut (ut_listing_id) WHERE ut_listing_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS unforgettable_ambassadors_ut_listing_id_key
  ON public.unforgettable_ambassadors (ut_listing_id) WHERE ut_listing_id IS NOT NULL;